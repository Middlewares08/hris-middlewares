const LeaveRequest = require('../../../../database/models/attendance/LeaveRequest');
const { logActivity } = require('../../../../utils/activityLogger');

const LEAVE_TYPES = [
    'vacation', 'sick', 'emergency', 'maternity',
    'paternity', 'bereavement', 'unpaid', 'other'
];

const actorId = (req) => (req.user?.id ? parseInt(req.user.id, 10) : null);
const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}/.test(String(value || ''));

/**
 * 🔍 READ (Paginated List, Search & Filters)
 */
const getAllLeaveRequests = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const { search, employee_id, status, leave_type, date_from, date_to } = req.query;
        const offset = (page - 1) * limit;

        let query = LeaveRequest.query()
            .where('attendance.leave_requests.is_deleted', false)
            .withGraphFetched('[employee, reviewer]');

        if (employee_id) query = query.where('employee_id', employee_id);
        if (status) query = query.where('status', status);
        if (leave_type) query = query.where('leave_type', leave_type);
        if (date_from) query = query.where('end_date', '>=', date_from);
        if (date_to) query = query.where('start_date', '<=', date_to);

        if (search) {
            query = query.where((builder) => {
                builder.where('reason', 'ilike', `%${search}%`)
                    .orWhereExists(
                        LeaveRequest.relatedQuery('employee').where((sub) => {
                            sub.where('first_name', 'ilike', `%${search}%`)
                                .orWhere('last_name', 'ilike', `%${search}%`);
                        })
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
                totalPages: Math.ceil(result.total / limit)
            }
        });
    } catch (error) {
        console.error('Fetch leave requests error:', error);
        return res.status(500).json({ success: false, message: 'Server error retrieving data matrix.' });
    }
};

/**
 * 🎯 READ (Single Target via Secure UUID)
 */
const getLeaveRequestByUuid = async (req, res) => {
    try {
        const leaveRequest = await LeaveRequest.query()
            .findOne({ uuid: req.params.uuid })
            .where('is_deleted', false)
            .withGraphFetched('[employee, reviewer]');

        if (!leaveRequest) {
            return res.status(404).json({ success: false, message: 'Leave request not found.' });
        }

        return res.status(200).json({ success: true, data: leaveRequest });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 📅 READ (History for a single employee, optionally scoped to a date range / status)
 */
const getLeaveRequestsByEmployee = async (req, res) => {
    try {
        const { employee_id } = req.params;
        const { status, leave_type, date_from, date_to } = req.query;

        let query = LeaveRequest.query()
            .where({ employee_id, is_deleted: false })
            .withGraphFetched('reviewer');

        if (status) query = query.where('status', status);
        if (leave_type) query = query.where('leave_type', leave_type);
        if (date_from) query = query.where('end_date', '>=', date_from);
        if (date_to) query = query.where('start_date', '<=', date_to);

        const requests = await query.orderBy('start_date', 'desc');

        return res.status(200).json({ success: true, data: requests });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 🙋 READ (Self-service history for the authenticated employee — no admin permission required)
 */
const getMyLeaveRequests = async (req, res) => {
    try {
        const employeeId = req.user?.id;
        if (!employeeId) {
            return res.status(401).json({ success: false, message: 'Unauthenticated request.' });
        }

        const { status, leave_type, date_from, date_to, limit } = req.query;

        let query = LeaveRequest.query()
            .where({ employee_id: employeeId, is_deleted: false })
            .withGraphFetched('reviewer');

        if (status) query = query.where('status', status);
        if (leave_type) query = query.where('leave_type', leave_type);
        if (date_from) query = query.where('end_date', '>=', date_from);
        if (date_to) query = query.where('start_date', '<=', date_to);

        query = query.orderBy('start_date', 'desc');
        if (limit) query = query.limit(parseInt(limit, 10));

        const requests = await query;

        return res.status(200).json({ success: true, data: requests });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ✅ Shared payload validation for create / update
 */
const validateLeavePayload = ({ leave_type, start_date, end_date, is_half_day, reason }, { partial = false } = {}) => {
    if (!partial || leave_type !== undefined) {
        if (!leave_type || !LEAVE_TYPES.includes(leave_type)) {
            return `leave_type must be one of: ${LEAVE_TYPES.join(', ')}`;
        }
    }
    if (!partial || start_date !== undefined) {
        if (!isValidDate(start_date)) return 'start_date must be a valid YYYY-MM-DD date.';
    }
    if (!partial || end_date !== undefined) {
        if (!isValidDate(end_date)) return 'end_date must be a valid YYYY-MM-DD date.';
    }
    if (start_date && end_date && String(end_date) < String(start_date)) {
        return 'end_date cannot be earlier than start_date.';
    }
    if (is_half_day && start_date && end_date && String(start_date) !== String(end_date)) {
        return 'A half-day request must start and end on the same date.';
    }
    if (!partial || reason !== undefined) {
        if (!reason || !String(reason).trim()) return 'reason is required.';
    }
    return null;
};

/**
 * 🚫 Rejects a new request that overlaps an existing active one for the same employee
 */
const findOverlap = (employeeId, startDate, endDate, excludeId) => {
    let query = LeaveRequest.query()
        .where('employee_id', employeeId)
        .where('is_deleted', false)
        .whereIn('status', ['pending', 'approved'])
        .where('start_date', '<=', endDate)
        .where('end_date', '>=', startDate);

    if (excludeId) query = query.whereNot('id', excludeId);
    return query.first();
};

/**
 * ➕ CREATE — files a leave request.
 * Self-service by default (owner = caller); an admin may file on behalf of another
 * employee by passing employee_id.
 */
const createLeaveRequest = async (req, res) => {
    try {
        const callerId = actorId(req);
        const {
            employee_id, leave_type, start_date, end_date,
            is_half_day = false, reason
        } = req.body;

        const validationError = validateLeavePayload(req.body);
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        const targetEmployeeId = employee_id || callerId;
        if (!targetEmployeeId) {
            return res.status(400).json({ success: false, message: 'employee_id is required.' });
        }

        const overlap = await findOverlap(targetEmployeeId, start_date, end_date);
        if (overlap) {
            return res.status(409).json({
                success: false,
                message: 'An active leave request already overlaps this date range.'
            });
        }

        const leaveRequest = await LeaveRequest.query().insertAndFetch({
            employee_id: targetEmployeeId,
            leave_type,
            start_date,
            end_date,
            is_half_day: Boolean(is_half_day),
            reason: String(reason).trim(),
            status: 'pending',
            created_by: callerId
        });

        await logActivity({
            employeeId: targetEmployeeId,
            action: 'leave.request_filed',
            category: 'leave',
            description: `Filed a ${leave_request_label(leaveRequest)} leave request`,
            metadata: {
                leave_request_uuid: leaveRequest.uuid,
                leave_type: leaveRequest.leave_type,
                start_date: leaveRequest.start_date,
                end_date: leaveRequest.end_date,
                total_days: leaveRequest.total_days
            },
            req
        });

        return res.status(201).json({ success: true, data: leaveRequest });
    } catch (error) {
        console.error('Create leave request error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 🔄 UPDATE (via UUID) — only the owner, and only while still pending
 */
const updateLeaveRequest = async (req, res) => {
    try {
        const { uuid } = req.params;
        const callerId = actorId(req);
        const { leave_type, start_date, end_date, is_half_day, reason } = req.body;

        const leaveRequest = await LeaveRequest.query().findOne({ uuid }).where('is_deleted', false);
        if (!leaveRequest) {
            return res.status(404).json({ success: false, message: 'Leave request not found.' });
        }

        if (leaveRequest.status !== 'pending') {
            return res.status(409).json({
                success: false,
                message: `A ${leaveRequest.status} leave request can no longer be edited.`
            });
        }

        const validationError = validateLeavePayload(
            {
                leave_type,
                start_date: start_date ?? leaveRequest.start_date,
                end_date: end_date ?? leaveRequest.end_date,
                is_half_day: is_half_day ?? leaveRequest.is_half_day,
                reason
            },
            { partial: true }
        );
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        const nextStart = start_date ?? leaveRequest.start_date;
        const nextEnd = end_date ?? leaveRequest.end_date;
        const nextHalfDay = is_half_day === undefined ? leaveRequest.is_half_day : Boolean(is_half_day);

        const overlap = await findOverlap(leaveRequest.employee_id, nextStart, nextEnd, leaveRequest.id);
        if (overlap) {
            return res.status(409).json({
                success: false,
                message: 'An active leave request already overlaps this date range.'
            });
        }

        const updated = await LeaveRequest.query().patchAndFetchById(leaveRequest.id, {
            leave_type,
            start_date,
            end_date,
            is_half_day: is_half_day === undefined ? undefined : Boolean(is_half_day),
            reason: reason === undefined ? undefined : String(reason).trim(),
            total_days: LeaveRequest.computeTotalDays({
                start_date: nextStart,
                end_date: nextEnd,
                is_half_day: nextHalfDay
            }),
            updated_by: callerId
        });

        await logActivity({
            employeeId: updated.employee_id,
            action: 'leave.request_updated',
            category: 'leave',
            description: `Updated a ${leave_request_label(updated)} leave request`,
            metadata: { leave_request_uuid: updated.uuid, total_days: updated.total_days },
            req
        });

        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        console.error('Update leave request error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ⚖️ REVIEW (via UUID) — approve or reject a pending request (admin/manager)
 */
const reviewLeaveRequest = async (req, res) => {
    try {
        const { uuid } = req.params;
        const callerId = actorId(req);
        const { decision, review_remarks } = req.body;

        if (!['approved', 'rejected'].includes(decision)) {
            return res.status(400).json({ success: false, message: "decision must be 'approved' or 'rejected'." });
        }

        const leaveRequest = await LeaveRequest.query().findOne({ uuid }).where('is_deleted', false);
        if (!leaveRequest) {
            return res.status(404).json({ success: false, message: 'Leave request not found.' });
        }

        if (leaveRequest.status !== 'pending') {
            return res.status(409).json({
                success: false,
                message: `This request has already been ${leaveRequest.status}.`
            });
        }

        const updated = await LeaveRequest.query().patchAndFetchById(leaveRequest.id, {
            status: decision,
            reviewed_by: callerId,
            reviewed_at: new Date().toISOString(),
            review_remarks: review_remarks ? String(review_remarks).trim() : null,
            updated_by: callerId
        });

        await logActivity({
            employeeId: updated.employee_id,
            action: `leave.request_${decision}`,
            category: 'leave',
            description: `Leave request for ${updated.start_date} → ${updated.end_date} was ${decision}`,
            metadata: { leave_request_uuid: updated.uuid, reviewed_by: callerId },
            req
        });

        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        console.error('Review leave request error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 🙅 CANCEL (via UUID) — owner withdraws their own pending/approved request
 */
const cancelLeaveRequest = async (req, res) => {
    try {
        const { uuid } = req.params;
        const callerId = actorId(req);

        const leaveRequest = await LeaveRequest.query().findOne({ uuid }).where('is_deleted', false);
        if (!leaveRequest) {
            return res.status(404).json({ success: false, message: 'Leave request not found.' });
        }

        if (callerId && leaveRequest.employee_id !== callerId) {
            return res.status(403).json({ success: false, message: 'You can only cancel your own leave requests.' });
        }

        if (!['pending', 'approved'].includes(leaveRequest.status)) {
            return res.status(409).json({
                success: false,
                message: `A ${leaveRequest.status} leave request cannot be cancelled.`
            });
        }

        const updated = await LeaveRequest.query().patchAndFetchById(leaveRequest.id, {
            status: 'cancelled',
            updated_by: callerId
        });

        await logActivity({
            employeeId: updated.employee_id,
            action: 'leave.request_cancelled',
            category: 'leave',
            description: `Cancelled a ${leave_request_label(updated)} leave request`,
            metadata: { leave_request_uuid: updated.uuid },
            req
        });

        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        console.error('Cancel leave request error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ❌ DELETE / ARCHIVE (via UUID) — soft delete (admin)
 */
const deleteLeaveRequest = async (req, res) => {
    try {
        const { uuid } = req.params;
        const callerId = actorId(req);

        const leaveRequest = await LeaveRequest.query().findOne({ uuid }).where('is_deleted', false);
        if (!leaveRequest) {
            return res.status(404).json({ success: false, message: 'Leave request not found.' });
        }

        await LeaveRequest.query().patchAndFetchById(leaveRequest.id, {
            is_deleted: true,
            updated_by: callerId
        });

        await logActivity({
            employeeId: leaveRequest.employee_id,
            action: 'leave.request_archived',
            category: 'leave',
            description: `Leave request for ${leaveRequest.start_date} → ${leaveRequest.end_date} archived`,
            metadata: { leave_request_uuid: leaveRequest.uuid },
            req
        });

        return res.status(200).json({ success: true, message: 'Leave request archived successfully.' });
    } catch (error) {
        console.error('Delete leave request error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Small helper for consistent human-readable log lines
function leave_request_label(row) {
    return `${row.leave_type} (${row.total_days} day${Number(row.total_days) === 1 ? '' : 's'})`;
}

module.exports = {
    getAllLeaveRequests,
    getLeaveRequestByUuid,
    getLeaveRequestsByEmployee,
    getMyLeaveRequests,
    createLeaveRequest,
    updateLeaveRequest,
    reviewLeaveRequest,
    cancelLeaveRequest,
    deleteLeaveRequest
};
