const ActivityLog = require('../../../../database/models/employee/ActivityLog');

const VALID_CATEGORIES = ['attendance', 'leave', 'payroll', 'profile', 'document', 'system'];

/**
 * 🙋 READ — Recent activity feed for the authenticated employee
 * Powers the "Recent Activity" timeline on the user dashboard.
 */
const getMyActivityLogs = async (req, res) => {
    try {
        const employeeId = req.user?.id;
        if (!employeeId) {
            return res.status(401).json({ success: false, message: 'Unauthenticated request.' });
        }

        const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
        const { category, date_from, date_to } = req.query;

        let query = ActivityLog.query()
            .where({ employee_id: employeeId, is_deleted: false });

        if (category) query = query.where('category', category);
        if (date_from) query = query.where('created_at', '>=', date_from);
        if (date_to) query = query.where('created_at', '<=', date_to);

        const logs = await query.orderBy('created_at', 'desc').limit(limit);

        return res.status(200).json({ success: true, data: logs });
    } catch (error) {
        console.error('Fetch my activity logs error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 🔍 READ — Paginated list (all employees), with search & filters
 */
const getAllActivityLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const { search, employee_id, category, action, date_from, date_to } = req.query;
        const offset = (page - 1) * limit;

        let query = ActivityLog.query()
            .where('employee.activity_logs.is_deleted', false)
            .withGraphFetched('employee');

        if (employee_id) query = query.where('employee_id', employee_id);
        if (category) query = query.where('category', category);
        if (action) query = query.where('action', action);
        if (date_from) query = query.where('created_at', '>=', date_from);
        if (date_to) query = query.where('created_at', '<=', date_to);

        if (search) {
            query = query.where('description', 'ilike', `%${search}%`);
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
                totalPages: Math.ceil(result.total / limit)
            }
        });
    } catch (error) {
        console.error('Fetch activity logs error:', error);
        return res.status(500).json({ success: false, message: 'Server error retrieving activity logs.' });
    }
};

/**
 * 🎯 READ — Single record via secure UUID
 */
const getActivityLogByUuid = async (req, res) => {
    try {
        const log = await ActivityLog.query()
            .findOne({ uuid: req.params.uuid })
            .where('is_deleted', false)
            .withGraphFetched('employee');

        if (!log) {
            return res.status(404).json({ success: false, message: 'Activity log not found.' });
        }

        return res.status(200).json({ success: true, data: log });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 📅 READ — History for a single employee
 */
const getActivityLogsByEmployee = async (req, res) => {
    try {
        const { employee_id } = req.params;
        const { category, date_from, date_to } = req.query;
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

        let query = ActivityLog.query()
            .where({ employee_id, is_deleted: false });

        if (category) query = query.where('category', category);
        if (date_from) query = query.where('created_at', '>=', date_from);
        if (date_to) query = query.where('created_at', '<=', date_to);

        const logs = await query.orderBy('created_at', 'desc').limit(limit);

        return res.status(200).json({ success: true, data: logs });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ➕ CREATE — record an activity entry
 * Defaults the owner to the authenticated caller unless an employee_id is supplied.
 */
const createActivityLog = async (req, res) => {
    try {
        const callerId = req.user?.id;
        const {
            employee_id,
            action,
            category,
            description,
            metadata
        } = req.body;

        const targetEmployeeId = employee_id || callerId;

        if (!targetEmployeeId) {
            return res.status(400).json({ success: false, message: 'employee_id is required.' });
        }

        if (!action || !description) {
            return res.status(400).json({ success: false, message: 'action and description are required.' });
        }

        if (category && !VALID_CATEGORIES.includes(category)) {
            return res.status(400).json({ success: false, message: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
        }

        const log = await ActivityLog.query().insertAndFetch({
            employee_id: targetEmployeeId,
            action,
            category: category || 'system',
            description,
            metadata: metadata || null,
            ip_address: req.ip || req.headers['x-forwarded-for'] || null,
            user_agent: (req.headers['user-agent'] || '').substring(0, 255) || null,
            created_by: callerId ? parseInt(callerId, 10) : null
        });

        return res.status(201).json({ success: true, data: log });
    } catch (error) {
        console.error('Create activity log error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ❌ DELETE / ARCHIVE — soft delete via UUID
 */
const deleteActivityLog = async (req, res) => {
    try {
        const { uuid } = req.params;
        const log = await ActivityLog.query().findOne({ uuid }).where('is_deleted', false);

        if (!log) {
            return res.status(404).json({ success: false, message: 'Activity log not found.' });
        }

        await ActivityLog.query().patchAndFetchById(log.id, { is_deleted: true });

        return res.status(200).json({ success: true, message: 'Activity log archived successfully.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getMyActivityLogs,
    getAllActivityLogs,
    getActivityLogByUuid,
    getActivityLogsByEmployee,
    createActivityLog,
    deleteActivityLog
};
