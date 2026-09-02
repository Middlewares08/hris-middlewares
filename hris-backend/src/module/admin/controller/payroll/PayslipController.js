// src/module/admin/controller/payroll/PayslipController.js
const Payslip = require('../../../../database/models/payroll/Payslip');
const PayrollRun = require('../../../../database/models/payroll/PayrollRun');
const PayslipAdjustment = require('../../../../database/models/payroll/PayslipAdjustment');
const PayComponent = require('../../../../database/models/payroll/PayComponent');
const PayslipRequest = require('../../../../database/models/payroll/PayslipRequest');
const Employee = require('../../../../database/models/employee/Employee');
const { logActivity } = require('../../../../utils/activityLogger');
const { buildPayslipPdfBuffer } = require('../../../../utils/payslipPdf');
const {
    actorId, withActor, ok, created, fail, serverError,
    parsePagination, paginationMeta, isValidNumber, toBool, trimOrNull, definedOnly,
} = require('./_helpers');

const RELEASED_STATES = ['released']; // what an employee is allowed to see

const PDF_GRAPH = '[lines, run.[period]]';

// The Payslip.employee relation only selects name columns; the PDF also wants the
// employee_id string + position/department, so load those separately and attach.
const attachPdfEmployee = async (slip) => {
    const emp = await Employee.query()
        .findById(slip.employee_id)
        .select('id', 'uuid', 'employee_id', 'first_name', 'last_name')
        .withGraphFetched('position.department');
    slip.employee = emp || slip.employee || null;
    return slip;
};

// Turn a payslip into a safe attachment filename, e.g. "payslip-dela-cruz-june-2026.pdf".
const pdfFilename = (slip) => {
    const last = slip.employee?.last_name || `emp${slip.employee_id}`;
    const period = slip.run?.period?.name || 'payslip';
    const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return `payslip-${slug(last)}-${slug(period)}.pdf`;
};

const streamPayslipPdf = async (res, slip) => {
    await attachPdfEmployee(slip);
    const buffer = await buildPayslipPdfBuffer(slip);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfFilename(slip)}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
};

/* ============================================================
 * ADMIN
 * ========================================================== */

const getAll = async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { payroll_run_id, employee_id, status } = req.query;

        let query = Payslip.query()
            .where('payroll.payslips.is_deleted', false)
            .withGraphFetched('[employee, run.[period]]');

        if (payroll_run_id) query = query.where('payroll_run_id', payroll_run_id);
        if (employee_id) query = query.where('employee_id', employee_id);
        if (status) query = query.where('payroll.payslips.status', status);

        const result = await query
            .orderBy('payroll.payslips.id', 'desc')
            .range(offset, offset + limit - 1);

        return ok(res, result.results, { pagination: paginationMeta(result.total, page, limit) });
    } catch (error) {
        return serverError(res, 'payslip.getAll', error);
    }
};

const getByUuid = async (req, res) => {
    try {
        const slip = await Payslip.query()
            .findOne({ 'payroll.payslips.uuid': req.params.uuid })
            .where('payroll.payslips.is_deleted', false)
            .withGraphFetched('[employee, lines, run.[period]]');
        if (!slip) return fail(res, 404, 'Payslip not found.');
        return ok(res, slip);
    } catch (error) {
        return serverError(res, 'payslip.getByUuid', error);
    }
};

// GET /payroll/payslips/:uuid/pdf — download a branded PDF for any payslip.
const getPdf = async (req, res) => {
    try {
        const slip = await Payslip.query()
            .findOne({ 'payroll.payslips.uuid': req.params.uuid })
            .where('payroll.payslips.is_deleted', false)
            .withGraphFetched(PDF_GRAPH);
        if (!slip) return fail(res, 404, 'Payslip not found.');
        return await streamPayslipPdf(res, slip);
    } catch (error) {
        return serverError(res, 'payslip.getPdf', error);
    }
};

const setStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const allowed = ['calculated', 'on_hold', 'released'];
        if (!allowed.includes(status)) {
            return fail(res, 400, `status must be one of: ${allowed.join(', ')}`);
        }

        const slip = await Payslip.query()
            .findOne({ 'payroll.payslips.uuid': req.params.uuid })
            .where('payroll.payslips.is_deleted', false);
        if (!slip) return fail(res, 404, 'Payslip not found.');
        if (slip.status === 'cancelled') return fail(res, 409, 'A cancelled payslip cannot change status.');

        const patch = { status, updated_by: actorId(req) };
        if (status === 'released' && !slip.released_at) patch.released_at = new Date().toISOString();

        const updated = await Payslip.query().patchAndFetchById(slip.id, patch).context(withActor(req));

        await logActivity({
            employeeId: slip.employee_id,
            action: `payroll.payslip_${status}`,
            category: 'payroll',
            description: `Payslip ${slip.uuid} set to ${status}`,
            metadata: { payslip_uuid: slip.uuid },
            req,
        });

        return ok(res, updated);
    } catch (error) {
        return serverError(res, 'payslip.setStatus', error);
    }
};

/* ============================================================
 * ADJUSTMENTS (queued against a run, applied on the next calculate)
 * ========================================================== */

const listAdjustments = async (req, res) => {
    try {
        const run = await PayrollRun.query().findOne({ uuid: req.params.run_uuid }).where('is_deleted', false);
        if (!run) return fail(res, 404, 'Payroll run not found.');

        const rows = await PayslipAdjustment.query()
            .where({ payroll_run_id: run.id, is_deleted: false })
            .withGraphFetched('[employee, component]')
            .orderBy('id', 'desc');

        return ok(res, rows);
    } catch (error) {
        return serverError(res, 'adjustment.list', error);
    }
};

const createAdjustment = async (req, res) => {
    try {
        const run = await PayrollRun.query().findOne({ uuid: req.params.run_uuid }).where('is_deleted', false);
        if (!run) return fail(res, 404, 'Payroll run not found.');
        if (!['draft', 'calculated'].includes(run.status)) {
            return fail(res, 409, `Adjustments cannot be added to a ${run.status} run.`);
        }

        const { employee_id, adjustment_type, label, amount, is_taxable, reason, component_id } = req.body;

        if (!Number.isInteger(Number(employee_id)) || Number(employee_id) <= 0) return fail(res, 400, 'employee_id must be a positive integer.');
        if (!['earning', 'deduction'].includes(adjustment_type)) return fail(res, 400, "adjustment_type must be 'earning' or 'deduction'.");
        if (!trimOrNull(label)) return fail(res, 400, 'label is required.');
        if (!isValidNumber(amount) || Number(amount) <= 0) return fail(res, 400, 'amount must be a positive number.');
        if (!trimOrNull(reason)) return fail(res, 400, 'reason is required.');

        const employee = await Employee.query().findById(employee_id).where('is_deleted', false);
        if (!employee) return fail(res, 404, 'Employee not found.');

        let resolvedComponentId = null;
        if (component_id !== undefined && component_id !== null && component_id !== '') {
            const comp = await PayComponent.query().findById(component_id).where('is_deleted', false);
            if (!comp) return fail(res, 404, 'Pay component not found.');
            resolvedComponentId = comp.id;
        }

        const row = await PayslipAdjustment.query()
            .insertAndFetch(definedOnly({
                payroll_run_id: run.id,
                employee_id: Number(employee_id),
                component_id: resolvedComponentId,
                adjustment_type,
                label: String(label).trim(),
                amount: Number(amount),
                is_taxable: toBool(is_taxable),
                reason: String(reason).trim(),
                status: 'pending',
                created_by: actorId(req),
            }))
            .context(withActor(req));

        await logActivity({
            employeeId: Number(employee_id),
            action: 'payroll.adjustment_created',
            category: 'payroll',
            description: `Queued ${adjustment_type} adjustment "${row.label}" (${row.amount}) on run ${run.uuid}`,
            metadata: { adjustment_uuid: row.uuid, run_uuid: run.uuid },
            req,
        });

        return created(res, row);
    } catch (error) {
        return serverError(res, 'adjustment.create', error);
    }
};

const removeAdjustment = async (req, res) => {
    try {
        const row = await PayslipAdjustment.query().findOne({ uuid: req.params.uuid }).where('is_deleted', false);
        if (!row) return fail(res, 404, 'Adjustment not found.');
        if (row.status === 'applied') {
            return fail(res, 409, 'This adjustment is already applied to a payslip. Recalculate the run after cancelling it.');
        }

        await PayslipAdjustment.query().patchAndFetchById(row.id, {
            is_deleted: true, status: 'cancelled', updated_by: actorId(req),
        }).context(withActor(req));

        return ok(res, { uuid: row.uuid }, { message: 'Adjustment cancelled.' });
    } catch (error) {
        return serverError(res, 'adjustment.remove', error);
    }
};

/* ============================================================
 * SELF-SERVICE (authenticated employee — token id === employee id)
 * ========================================================== */

const getMine = async (req, res) => {
    try {
        const employeeId = actorId(req);
        if (!employeeId) return fail(res, 401, 'Unauthenticated request.');

        const limit = Math.min(parseInt(req.query.limit, 10) || 12, 50);

        const slips = await Payslip.query()
            .where('payroll.payslips.employee_id', employeeId)
            .where('payroll.payslips.is_deleted', false)
            .whereIn('payroll.payslips.status', RELEASED_STATES)
            .withGraphFetched('run.[period]')
            .orderBy('payroll.payslips.released_at', 'desc')
            .limit(limit);

        return ok(res, slips);
    } catch (error) {
        return serverError(res, 'payslip.getMine', error);
    }
};

const getMineByUuid = async (req, res) => {
    try {
        const employeeId = actorId(req);
        if (!employeeId) return fail(res, 401, 'Unauthenticated request.');

        const slip = await Payslip.query()
            .findOne({ 'payroll.payslips.uuid': req.params.uuid })
            .where('payroll.payslips.employee_id', employeeId)
            .where('payroll.payslips.is_deleted', false)
            .whereIn('payroll.payslips.status', RELEASED_STATES)
            .withGraphFetched('[lines, run.[period]]');

        if (!slip) return fail(res, 404, 'Payslip not found.');
        return ok(res, slip);
    } catch (error) {
        return serverError(res, 'payslip.getMineByUuid', error);
    }
};

// GET /payroll/payslips/me/:uuid/pdf — employee downloads a PDF of their own released payslip.
const getMinePdf = async (req, res) => {
    try {
        const employeeId = actorId(req);
        if (!employeeId) return fail(res, 401, 'Unauthenticated request.');

        const slip = await Payslip.query()
            .findOne({ 'payroll.payslips.uuid': req.params.uuid })
            .where('payroll.payslips.employee_id', employeeId)
            .where('payroll.payslips.is_deleted', false)
            .whereIn('payroll.payslips.status', RELEASED_STATES)
            .withGraphFetched(PDF_GRAPH);
        if (!slip) return fail(res, 404, 'Payslip not found.');
        return await streamPayslipPdf(res, slip);
    } catch (error) {
        return serverError(res, 'payslip.getMinePdf', error);
    }
};

/* ---- Payslip copy requests (self-service) ---- */

const getMineRequests = async (req, res) => {
    try {
        const employeeId = actorId(req);
        if (!employeeId) return fail(res, 401, 'Unauthenticated request.');

        const rows = await PayslipRequest.query()
            .where('payroll.payslip_requests.employee_id', employeeId)
            .where('payroll.payslip_requests.is_deleted', false)
            .withGraphFetched('[reviewer, payslip.[run.[period]]]')
            .orderBy('payroll.payslip_requests.created_at', 'desc');

        return ok(res, rows);
    } catch (error) {
        return serverError(res, 'payslipRequest.getMine', error);
    }
};

const createRequest = async (req, res) => {
    try {
        const employeeId = actorId(req);
        if (!employeeId) return fail(res, 401, 'Unauthenticated request.');

        const { payslip_uuid } = req.body;
        const reason = trimOrNull(req.body.reason);
        if (!payslip_uuid) return fail(res, 400, 'payslip_uuid is required.');
        if (!reason) return fail(res, 400, 'reason is required.');

        const slip = await Payslip.query()
            .findOne({ 'payroll.payslips.uuid': payslip_uuid })
            .where('payroll.payslips.is_deleted', false);
        if (!slip || Number(slip.employee_id) !== employeeId) return fail(res, 404, 'Payslip not found.');
        if (!RELEASED_STATES.includes(slip.status)) {
            return fail(res, 400, 'A copy can only be requested for a released payslip.');
        }

        const existing = await PayslipRequest.query()
            .where({ employee_id: employeeId, payslip_id: slip.id, status: 'pending', is_deleted: false })
            .first();
        if (existing) return fail(res, 409, 'You already have a pending request for this payslip.');

        const row = await PayslipRequest.query()
            .insertAndFetch({
                employee_id: employeeId,
                payslip_id: slip.id,
                reason,
                status: 'pending',
                created_by: employeeId,
            })
            .context(withActor(req));

        await logActivity({
            employeeId,
            action: 'payroll.payslip_request_filed',
            category: 'payroll',
            description: `Requested an official copy of payslip ${slip.uuid}`,
            metadata: { request_uuid: row.uuid, payslip_uuid: slip.uuid },
            req,
        });

        return created(res, row);
    } catch (error) {
        return serverError(res, 'payslipRequest.create', error);
    }
};

const cancelRequest = async (req, res) => {
    try {
        const employeeId = actorId(req);
        if (!employeeId) return fail(res, 401, 'Unauthenticated request.');

        const row = await PayslipRequest.query()
            .findOne({ uuid: req.params.uuid })
            .where('is_deleted', false);
        if (!row || Number(row.employee_id) !== employeeId) return fail(res, 404, 'Payslip request not found.');
        if (row.status !== 'pending') {
            return fail(res, 409, `A ${row.status} request cannot be cancelled.`);
        }

        const updated = await PayslipRequest.query()
            .patchAndFetchById(row.id, { status: 'cancelled', updated_by: employeeId })
            .context(withActor(req));

        return ok(res, updated, { message: 'Request cancelled.' });
    } catch (error) {
        return serverError(res, 'payslipRequest.cancel', error);
    }
};

module.exports = {
    getAll,
    getByUuid,
    getPdf,
    setStatus,
    listAdjustments,
    createAdjustment,
    removeAdjustment,
    getMine,
    getMineByUuid,
    getMinePdf,
    getMineRequests,
    createRequest,
    cancelRequest,
};
