const Attendance = require('../../../../database/models/attendance/Attendance');
const { logActivity } = require('../../../../utils/activityLogger');

const formatTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

/**
 * 🔍 READ (Paginated List, Search & Filters)
 */
const getAllAttendance = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const { search, employee_id, status, date_from, date_to } = req.query;
        const offset = (page - 1) * limit;

        let query = Attendance.query()
            .where('attendance.attendance_logs.is_deleted', false)
            .withGraphFetched('employee');

        if (employee_id) {
            query = query.where('employee_id', employee_id);
        }

        if (status) {
            query = query.where('status', status);
        }

        if (date_from) {
            query = query.where('log_date', '>=', date_from);
        }

        if (date_to) {
            query = query.where('log_date', '<=', date_to);
        }

        if (search) {
            query = query.whereExists(
                Attendance.relatedQuery('employee').where((builder) => {
                    builder.where('first_name', 'ilike', `%${search}%`)
                        .orWhere('last_name', 'ilike', `%${search}%`);
                })
            );
        }

        const result = await query
            .orderBy('log_date', 'desc')
            .range(offset, offset + limit - 1);

        return res.status(200).json({
            success: true,
            data: result.results,
            pagination: {
                totalRecords: result.total,
                currentPage: page,
                recordsPerPage: limit,
                totalPages: Math.ceil(result.total / limit)
            }
        });
    } catch (error) {
        console.error('Fetch attendance error:', error);
        return res.status(500).json({ success: false, message: 'Server error retrieving data matrix.' });
    }
};

/**
 * 🎯 READ (Single Target via Secure UUID)
 */
const getAttendanceByUuid = async (req, res) => {
    try {
        const attendance = await Attendance.query()
            .findOne({ uuid: req.params.uuid })
            .where('is_deleted', false)
            .withGraphFetched('employee');

        if (!attendance) {
            return res.status(404).json({ success: false, message: 'Attendance record not found' });
        }

        return res.status(200).json({ success: true, data: attendance });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 📅 READ (History for a single employee, optionally scoped to a date range)
 */
const getAttendanceByEmployee = async (req, res) => {
    try {
        const { employee_id } = req.params;
        const { date_from, date_to } = req.query;

        let query = Attendance.query()
            .where({ employee_id, is_deleted: false });

        if (date_from) query = query.where('log_date', '>=', date_from);
        if (date_to) query = query.where('log_date', '<=', date_to);

        const logs = await query.orderBy('log_date', 'desc');

        return res.status(200).json({ success: true, data: logs });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 🙋 READ (Self-service history for the authenticated employee — no admin permission required,
 * since a caller is always allowed to see their own attendance)
 */
const getMyAttendance = async (req, res) => {
    try {
        const employeeId = req.user?.id;
        if (!employeeId) {
            return res.status(401).json({ success: false, message: 'Unauthenticated request.' });
        }

        const { date_from, date_to, limit } = req.query;

        let query = Attendance.query().where({ employee_id: employeeId, is_deleted: false });

        if (date_from) query = query.where('log_date', '>=', date_from);
        if (date_to) query = query.where('log_date', '<=', date_to);

        query = query.orderBy('log_date', 'desc');

        if (limit) query = query.limit(parseInt(limit, 10));

        const logs = await query;

        return res.status(200).json({ success: true, data: logs });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ⏰ CLOCK IN — creates today's log for the authenticated employee
 */
const clockIn = async (req, res) => {
    try {
        const employeeId = req.user?.id;
        if (!employeeId) {
            return res.status(401).json({ success: false, message: 'Unauthenticated request.' });
        }

        const today = new Date().toISOString().substring(0, 10);

        const existing = await Attendance.query()
            .findOne({ employee_id: employeeId, log_date: today, is_deleted: false });

        if (existing) {
            return res.status(409).json({ success: false, message: 'You have already clocked in today.' });
        }

        const log = await Attendance.query().insertAndFetch({
            employee_id: employeeId,
            log_date: today,
            time_in: new Date().toISOString(),
            source: req.body?.source || 'web',
            created_by: employeeId
        });

        await logActivity({
            employeeId,
            action: 'attendance.clock_in',
            category: 'attendance',
            description: `Clocked in at ${formatTime(log.time_in)}`,
            metadata: { attendance_uuid: log.uuid, log_date: today, status: log.status },
            req
        });

        return res.status(201).json({ success: true, message: 'Clocked in successfully.', data: log });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ⏹️ CLOCK OUT — closes out today's log for the authenticated employee
 */
const clockOut = async (req, res) => {
    try {
        const employeeId = req.user?.id;
        if (!employeeId) {
            return res.status(401).json({ success: false, message: 'Unauthenticated request.' });
        }

        const today = new Date().toISOString().substring(0, 10);

        const existing = await Attendance.query()
            .findOne({ employee_id: employeeId, log_date: today, is_deleted: false });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'No clock-in found for today.' });
        }

        if (existing.time_out) {
            return res.status(409).json({ success: false, message: 'You have already clocked out today.' });
        }

        const log = await Attendance.query().patchAndFetchById(existing.id, {
            time_out: new Date().toISOString(),
            updated_by: employeeId
        });

        await logActivity({
            employeeId,
            action: 'attendance.clock_out',
            category: 'attendance',
            description: `Clocked out at ${formatTime(log.time_out)}`,
            metadata: { attendance_uuid: log.uuid, log_date: today, worked_hours: log.worked_hours },
            req
        });

        return res.status(200).json({ success: true, message: 'Clocked out successfully.', data: log });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ➕ CREATE (Manual/admin entry — backfills, corrections, leave/holiday marking)
 */
const createAttendance = async (req, res) => {
    try {
        const { employee_id, log_date, time_in, time_out, status, source, remarks } = req.body;

        if (!employee_id || !log_date) {
            return res.status(400).json({ success: false, message: 'employee_id and log_date are required.' });
        }

        const existing = await Attendance.query()
            .findOne({ employee_id, log_date, is_deleted: false });

        if (existing) {
            return res.status(400).json({ success: false, message: `Attendance for this employee on ${log_date} already exists.` });
        }

        const attendance = await Attendance.query().insertAndFetch({
            employee_id,
            log_date,
            time_in: time_in || null,
            time_out: time_out || null,
            status: status || 'present',
            source: source || 'manual',
            remarks: remarks || null,
            created_by: req.user?.id ? parseInt(req.user.id, 10) : null
        });

        await logActivity({
            employeeId: employee_id,
            action: 'attendance.record_created',
            category: 'attendance',
            description: `Attendance for ${log_date} recorded (${attendance.status})`,
            metadata: { attendance_uuid: attendance.uuid, log_date, source: attendance.source },
            req
        });

        return res.status(201).json({ success: true, data: attendance });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 🔄 UPDATE (via UUID)
 */
const updateAttendance = async (req, res) => {
    try {
        const { uuid } = req.params;
        const { time_in, time_out, status, source, remarks } = req.body;

        const attendance = await Attendance.query().findOne({ uuid }).where('is_deleted', false);

        if (!attendance) {
            return res.status(404).json({ success: false, message: 'Attendance record not found.' });
        }

        const updated = await Attendance.query().patchAndFetchById(attendance.id, {
            time_in,
            time_out,
            status,
            source,
            remarks,
            updated_by: req.user?.id ? parseInt(req.user.id, 10) : null
        });

        await logActivity({
            employeeId: updated.employee_id,
            action: 'attendance.record_updated',
            category: 'attendance',
            description: `Attendance for ${updated.log_date} updated (${updated.status})`,
            metadata: { attendance_uuid: updated.uuid, log_date: updated.log_date },
            req
        });

        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ❌ DELETE / ARCHIVE (via UUID)
 */
const deleteAttendance = async (req, res) => {
    try {
        const { uuid } = req.params;
        const attendance = await Attendance.query().findOne({ uuid }).where('is_deleted', false);

        if (!attendance) {
            return res.status(404).json({ success: false, message: 'Attendance record not found.' });
        }

        await Attendance.query().patchAndFetchById(attendance.id, {
            is_deleted: true,
            updated_by: req.user?.id ? parseInt(req.user.id, 10) : null
        });

        await logActivity({
            employeeId: attendance.employee_id,
            action: 'attendance.record_archived',
            category: 'attendance',
            description: `Attendance for ${attendance.log_date} archived`,
            metadata: { attendance_uuid: attendance.uuid, log_date: attendance.log_date },
            req
        });

        return res.status(200).json({ success: true, message: 'Attendance record archived successfully.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAllAttendance,
    getAttendanceByUuid,
    getAttendanceByEmployee,
    getMyAttendance,
    clockIn,
    clockOut,
    createAttendance,
    updateAttendance,
    deleteAttendance
};
