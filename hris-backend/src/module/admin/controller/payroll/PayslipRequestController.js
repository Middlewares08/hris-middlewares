// src/module/admin/controller/payroll/PayslipRequestController.js
//
// Admin side of the payslip-request workflow. Employees file requests via the
// self-service handlers on PayslipController; here HR lists, fulfils, rejects or
// archives them. Gated by the already-seeded `run-payroll:*` permissions.

const PayslipRequest = require('../../../../database/models/payroll/PayslipRequest');
const { logActivity } = require('../../../../utils/activityLogger');
const { notifyPayslipRequestFulfilled } = require('../../../../utils/notify');
const {
    actorId, withActor, ok, fail, serverError,
    parsePagination, paginationMeta, trimOrNull,
} = require('./_helpers');

const REQUEST_GRAPH = '[employee, reviewer, payslip.[run.[period]]]';

const getAll = async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { status, employee_id } = req.query;

        let query = PayslipRequest.query()
            .where('payroll.payslip_requests.is_deleted', false)
            .withGraphFetched(REQUEST_GRAPH);

        if (status) query = query.where('payroll.payslip_requests.status', status);
        if (employee_id) query = query.where('payroll.payslip_requests.employee_id', employee_id);

        const result = await query
            .orderBy('payroll.payslip_requests.created_at', 'desc')
            .range(offset, offset + limit - 1);

        return ok(res, result.results, { pagination: paginationMeta(result.total, page, limit) });
    } catch (error) {
        return serverError(res, 'payslipRequest.getAll', error);
    }
};

const fulfill = async (req, res) => {
    try {
        const row = await PayslipRequest.query()
            .findOne({ uuid: req.params.uuid })
            .where('is_deleted', false);
        if (!row) return fail(res, 404, 'Payslip request not found.');
        if (row.status !== 'pending') {
            return fail(res, 409, `This request has already been ${row.status}.`);
        }

        const updated = await PayslipRequest.query()
            .patchAndFetchById(row.id, {
                status: 'fulfilled',
                reviewed_by: actorId(req),
                reviewed_at: new Date().toISOString(),
                review_remarks: trimOrNull(req.body.review_remarks),
                fulfilled_at: new Date().toISOString(),
                updated_by: actorId(req),
            })
            .context(withActor(req))
            .withGraphFetched(REQUEST_GRAPH);

        await logActivity({
            employeeId: row.employee_id,
            action: 'payroll.payslip_request_fulfilled',
            category: 'payroll',
            description: `Payslip copy request ${row.uuid} fulfilled`,
            metadata: { request_uuid: row.uuid, payslip_id: row.payslip_id },
            req,
        });

        // Best-effort email to the employee — never blocks the response.
        notifyPayslipRequestFulfilled({
            employeeId: row.employee_id,
            periodName: updated.payslip?.run?.period?.name || null,
            remarks: updated.review_remarks,
        });

        return ok(res, updated, { message: 'Request fulfilled.' });
    } catch (error) {
        return serverError(res, 'payslipRequest.fulfill', error);
    }
};

const reject = async (req, res) => {
    try {
        const remarks = trimOrNull(req.body.review_remarks);
        if (!remarks) return fail(res, 400, 'review_remarks is required when rejecting a request.');

        const row = await PayslipRequest.query()
            .findOne({ uuid: req.params.uuid })
            .where('is_deleted', false);
        if (!row) return fail(res, 404, 'Payslip request not found.');
        if (row.status !== 'pending') {
            return fail(res, 409, `This request has already been ${row.status}.`);
        }

        const updated = await PayslipRequest.query()
            .patchAndFetchById(row.id, {
                status: 'rejected',
                reviewed_by: actorId(req),
                reviewed_at: new Date().toISOString(),
                review_remarks: remarks,
                updated_by: actorId(req),
            })
            .context(withActor(req))
            .withGraphFetched(REQUEST_GRAPH);

        await logActivity({
            employeeId: row.employee_id,
            action: 'payroll.payslip_request_rejected',
            category: 'payroll',
            description: `Payslip copy request ${row.uuid} rejected`,
            metadata: { request_uuid: row.uuid },
            req,
        });

        return ok(res, updated, { message: 'Request rejected.' });
    } catch (error) {
        return serverError(res, 'payslipRequest.reject', error);
    }
};

const remove = async (req, res) => {
    try {
        const row = await PayslipRequest.query()
            .findOne({ uuid: req.params.uuid })
            .where('is_deleted', false);
        if (!row) return fail(res, 404, 'Payslip request not found.');

        await PayslipRequest.query()
            .patchAndFetchById(row.id, { is_deleted: true, updated_by: actorId(req) })
            .context(withActor(req));

        await logActivity({
            employeeId: row.employee_id,
            action: 'payroll.payslip_request_archived',
            category: 'payroll',
            description: `Payslip copy request ${row.uuid} archived`,
            metadata: { request_uuid: row.uuid },
            req,
        });

        return ok(res, { uuid: row.uuid }, { message: 'Request archived.' });
    } catch (error) {
        return serverError(res, 'payslipRequest.remove', error);
    }
};

module.exports = { getAll, fulfill, reject, remove };
