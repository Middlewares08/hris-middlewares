const OvertimeRequest = require('../../../../database/models/attendance/OvertimeRequest');
const Setting = require('../../../../database/models/system/Setting');
const { logActivity } = require('../../../../utils/activityLogger');

const MAX_OT_HOURS_PER_DAY = 12;

const actorId = (req) => (req.user?.id ? parseInt(req.user.id, 10) : null);
const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}/.test(String(value || ''));

/** Blocks filing / editing while the Overtime module is switched off. Reads allowed. */
const ensureOvertimeEnabled = async (res) => {
    const enabled = await Setting.getBool('overtime.enabled', true);
    if (!enabled) {
        res.status(403).json({ success: false, message: 'Overtime filing is currently disabled.' });
        return false;
    }
    return true;
};

/**
 * ✅ Shared payload validation for create / update
 */
const validatePayload = ({ work_date, hours, reason }, { partial = false } = {}) => {
    if (!partial || work_date !== undefined) {
        if (!isValidDate(work_date)) return 'work_date must be a valid YYYY-MM-DD date.';
    }
    if (!partial || hours !== undefined) {
        const n = Number(hours);
        if (!Number.isFinite(n) || n <= 0) return 'hours must be a positive number.';
        if (n > MAX_OT_HOURS_PER_DAY) return `hours cannot exceed ${MAX_OT_HOURS_PER_DAY} per day.`;
    }
    if (!partial || reason !== undefined) {
        if (!reason || !String(reason).trim()) return 'reason is required.';
    }
    return null;
};

/**
 * 🚫 Rejects a new filing that duplicates an existing active one for the same day
 */
const findSameDayActive = (employeeId, workDate, excludeId) => {
    let query = OvertimeRequest.query()
        .where('employee_id', employeeId)
        .where('is_deleted', false)
        .whereIn('status', ['pending', 'approved'])
        .where('work_date', workDate);
    if (excludeId) query = query.whereNot('id', excludeId);
    return query.first();
};

/* ============================================================
 * ADMIN — gated by the 'overtime-tracker' module permissions
 * ========================================================== */

const getAllOvertimeRequests = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const { search, employee_id, status, date_from, date_to } = req.query;
        const offset = (page - 1) * limit;

        let query = OvertimeRequest.query()
            .where('attendance.overtime_requests.is_deleted', false)
            .withGraphFetched('[employee, reviewer]');

        if (employee_id) query = query.where('employee_id', employee_id);
        if (status) query = query.where('status', status);
        if (date_from) query = query.where('work_date', '>=', date_from);
        if (date_to) query = query.where('work_date', '<=', date_to);

        if (search) {
            query = query.where((builder) => {
                builder.where('reason', 'ilike', `%${search}%`)
                    .orWhereExists(
                        OvertimeRequest.relatedQuery('employee').where((sub) => {
                            sub.where('first_name', 'ilike', `%${search}%`)
                                .orWhere('last_name', 'ilike', `%${search}%`);
                        }),
                    );
            });
        }

        const result = await query
            .orderBy('created_at', 'desc')
            .range(offset, offset + limit - 1);

        return res.status(200).json({
            success: true,
            data: result.results,
            pagination: {
                totalRecords: result.total,
                currentPage: page,
                recordsPerPage: limit,
                totalPages: Math.ceil(result.total / limit),
            },
        });
    } catch (error) {
        console.error('Fetch overtime requests error:', error);
        return res.status(500).json({ success: false, message: 'Server error retrieving data matrix.' });
    }
};

const getOvertimeRequestByUuid = async (req, res) => {
    try {
        const row = await OvertimeRequest.query()
            .findOne({ uuid: req.params.uuid })
            .where('is_deleted', false)
            .withGraphFetched('[employee, reviewer]');

        if (!row) {
            return res.status(404).json({ success: false, message: 'Overtime request not found.' });
        }
        return res.status(200).json({ success: true, data: row });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getOvertimeRequestsByEmployee = async (req, res) => {
    try {
        const { employee_id } = req.params;
        const { status, date_from, date_to } = req.query;

        let query = OvertimeRequest.query()
            .where({ employee_id, is_deleted: false })
            .withGraphFetched('reviewer');

        if (status) query = query.where('status', status);
        if (date_from) query = query.where('work_date', '>=', date_from);
        if (date_to) query = query.where('work_date', '<=', date_to);

        const requests = await query.orderBy('work_date', 'desc');
        return res.status(200).json({ success: true, data: requests });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/* ============================================================
 * SELF-SERVICE (any authenticated employee)
 * ========================================================== */

const getMyOvertimeRequests = async (req, res) => {
    try {
        const employeeId = req.user?.id;
        if (!employeeId) {
            return res.status(401).json({ success: false, message: 'Unauthenticated request.' });
        }

        const { status, date_from, date_to, limit } = req.query;

        let query = OvertimeRequest.query()
            .where({ employee_id: employeeId, is_deleted: false })
            .withGraphFetched('reviewer');

        if (status) query = query.where('status', status);
        if (date_from) query = query.where('work_date', '>=', date_from);
        if (date_to) query = query.where('work_date', '<=', date_to);

        query = query.orderBy('work_date', 'desc');
        if (limit) query = query.limit(parseInt(limit, 10));

        const requests = await query;
        return res.status(200).json({ success: true, data: requests });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ➕ CREATE — files an overtime request (self-service; admin may pass employee_id).
 */
const createOvertimeRequest = async (req, res) => {
    try {
        if (!(await ensureOvertimeEnabled(res))) return undefined;

        const callerId = actorId(req);
        const { employee_id, work_date, hours, reason } = req.body;

        const validationError = validatePayload(req.body);
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        const targetEmployeeId = employee_id || callerId;
        if (!targetEmployeeId) {
            return res.status(400).json({ success: false, message: 'employee_id is required.' });
        }

        const dupe = await findSameDayActive(targetEmployeeId, work_date);
        if (dupe) {
            return res.status(409).json({
                success: false,
                message: `An active overtime request already exists for ${work_date}.`,
            });
        }

        const row = await OvertimeRequest.query().insertAndFetch({
            employee_id: targetEmployeeId,
            work_date,
            hours: Number(hours),
            reason: String(reason).trim(),
            status: 'pending',
            created_by: callerId,
        });

        await logActivity({
            employeeId: targetEmployeeId,
            action: 'overtime.request_filed',
            category: 'attendance',
            description: `Filed an overtime request for ${row.work_date} (${row.hours}h)`,
            metadata: { overtime_uuid: row.uuid, work_date: row.work_date, hours: row.hours },
            req,
        });

        return res.status(201).json({ success: true, data: row });
    } catch (error) {
        console.error('Create overtime request error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 🔄 UPDATE (via UUID) — owner only, while still pending
 */
const updateOvertimeRequest = async (req, res) => {
    try {
        if (!(await ensureOvertimeEnabled(res))) return undefined;

        const { uuid } = req.params;
        const callerId = actorId(req);
        const { work_date, hours, reason } = req.body;

        const row = await OvertimeRequest.query().findOne({ uuid }).where('is_deleted', false);
        if (!row) {
            return res.status(404).json({ success: false, message: 'Overtime request not found.' });
        }
        if (callerId && row.employee_id !== callerId) {
            return res.status(403).json({ success: false, message: 'You can only edit your own overtime requests.' });
        }
        if (row.status !== 'pending') {
            return res.status(409).json({ success: false, message: `A ${row.status} overtime request can no longer be edited.` });
        }

        const validationError = validatePayload({ work_date, hours, reason }, { partial: true });
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        const nextWorkDate = work_date ?? row.work_date;
        if (work_date && work_date !== row.work_date) {
            const dupe = await findSameDayActive(row.employee_id, nextWorkDate, row.id);
            if (dupe) {
                return res.status(409).json({ success: false, message: `An active overtime request already exists for ${nextWorkDate}.` });
            }
        }

        const updated = await OvertimeRequest.query().patchAndFetchById(row.id, {
            work_date,
            hours: hours === undefined ? undefined : Number(hours),
            reason: reason === undefined ? undefined : String(reason).trim(),
            updated_by: callerId,
        });

        await logActivity({
            employeeId: updated.employee_id,
            action: 'overtime.request_updated',
            category: 'attendance',
            description: `Updated an overtime request for ${updated.work_date} (${updated.hours}h)`,
            metadata: { overtime_uuid: updated.uuid },
            req,
        });

        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        console.error('Update overtime request error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ⚖️ REVIEW (via UUID) — approve / reject a pending request (admin/manager)
 */
const reviewOvertimeRequest = async (req, res) => {
    try {
        const { uuid } = req.params;
        const callerId = actorId(req);
        const { decision, review_remarks } = req.body;

        if (!['approved', 'rejected'].includes(decision)) {
            return res.status(400).json({ success: false, message: "decision must be 'approved' or 'rejected'." });
        }

        const row = await OvertimeRequest.query().findOne({ uuid }).where('is_deleted', false);
        if (!row) {
            return res.status(404).json({ success: false, message: 'Overtime request not found.' });
        }
        if (row.status !== 'pending') {
            return res.status(409).json({ success: false, message: `This request has already been ${row.status}.` });
        }

        const updated = await OvertimeRequest.query().patchAndFetchById(row.id, {
            status: decision,
            reviewed_by: callerId,
            reviewed_at: new Date().toISOString(),
            review_remarks: review_remarks ? String(review_remarks).trim() : null,
            updated_by: callerId,
        });

        await logActivity({
            employeeId: updated.employee_id,
            action: `overtime.request_${decision}`,
            category: 'attendance',
            description: `Overtime request for ${updated.work_date} (${updated.hours}h) was ${decision}`,
            metadata: { overtime_uuid: updated.uuid, reviewed_by: callerId },
            req,
        });

        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        console.error('Review overtime request error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 🙅 CANCEL (via UUID) — owner withdraws their own pending/approved request
 */
const cancelOvertimeRequest = async (req, res) => {
    try {
        const { uuid } = req.params;
        const callerId = actorId(req);

        const row = await OvertimeRequest.query().findOne({ uuid }).where('is_deleted', false);
        if (!row) {
            return res.status(404).json({ success: false, message: 'Overtime request not found.' });
        }
        if (callerId && row.employee_id !== callerId) {
            return res.status(403).json({ success: false, message: 'You can only cancel your own overtime requests.' });
        }
        if (!['pending', 'approved'].includes(row.status)) {
            return res.status(409).json({ success: false, message: `A ${row.status} overtime request cannot be cancelled.` });
        }

        const updated = await OvertimeRequest.query().patchAndFetchById(row.id, {
            status: 'cancelled',
            updated_by: callerId,
        });

        await logActivity({
            employeeId: updated.employee_id,
            action: 'overtime.request_cancelled',
            category: 'attendance',
            description: `Cancelled an overtime request for ${updated.work_date} (${updated.hours}h)`,
            metadata: { overtime_uuid: updated.uuid },
            req,
        });

        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        console.error('Cancel overtime request error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ❌ DELETE / ARCHIVE (via UUID) — soft delete (admin)
 */
const deleteOvertimeRequest = async (req, res) => {
    try {
        const { uuid } = req.params;
        const callerId = actorId(req);

        const row = await OvertimeRequest.query().findOne({ uuid }).where('is_deleted', false);
        if (!row) {
            return res.status(404).json({ success: false, message: 'Overtime request not found.' });
        }

        await OvertimeRequest.query().patchAndFetchById(row.id, {
            is_deleted: true,
            updated_by: callerId,
        });

        await logActivity({
            employeeId: row.employee_id,
            action: 'overtime.request_archived',
            category: 'attendance',
            description: `Overtime request for ${row.work_date} (${row.hours}h) archived`,
            metadata: { overtime_uuid: row.uuid },
            req,
        });

        return res.status(200).json({ success: true, message: 'Overtime request archived successfully.' });
    } catch (error) {
        console.error('Delete overtime request error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAllOvertimeRequests,
    getOvertimeRequestByUuid,
    getOvertimeRequestsByEmployee,
    getMyOvertimeRequests,
    createOvertimeRequest,
    updateOvertimeRequest,
    reviewOvertimeRequest,
    cancelOvertimeRequest,
    deleteOvertimeRequest,
};
