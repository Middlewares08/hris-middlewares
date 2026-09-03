// src/module/admin/controller/payroll/PayrollRunController.js
const { Model } = require('objection');
const PayrollRun = require('../../../../database/models/payroll/PayrollRun');
const PayPeriod = require('../../../../database/models/payroll/PayPeriod');
const Payslip = require('../../../../database/models/payroll/Payslip');
const PayslipLine = require('../../../../database/models/payroll/PayslipLine');
const EmployeeComponentAssignment = require('../../../../database/models/payroll/EmployeeComponentAssignment');
const { calculateRun } = require('../../services/payrollCalculator');
const { logActivity } = require('../../../../utils/activityLogger');
const { notifyPayrollRunApproved } = require('../../../../utils/notify');
const {
    actorId, withActor, ok, created, fail, serverError,
    parsePagination, paginationMeta, trimOrNull, definedOnly, round2,
} = require('./_helpers');

/**
 * Apply (direction = -1) or reverse (direction = +1) loan amortization for every
 * loan-backed deduction line in a run. Runs inside the caller's transaction.
 * Only assignments that actually track a balance (outstanding_balance not null) move.
 */
const amortizeRunLoans = async (trx, runId, direction, actor) => {
    const totals = await PayslipLine.query(trx)
        .join('payroll.payslips', 'payroll.payslips.id', 'payroll.payslip_lines.payslip_id')
        .where('payroll.payslips.payroll_run_id', runId)
        .where('payroll.payslips.is_deleted', false)
        .where('payroll.payslip_lines.is_deleted', false)
        .where('payroll.payslip_lines.line_type', 'deduction')
        .whereNotNull('payroll.payslip_lines.assignment_id')
        .groupBy('payroll.payslip_lines.assignment_id')
        .select('payroll.payslip_lines.assignment_id as assignment_id')
        .sum('payroll.payslip_lines.amount as total');

    for (const row of totals) {
        const a = await EmployeeComponentAssignment.query(trx).findById(row.assignment_id);
        if (!a || a.outstanding_balance === null || a.outstanding_balance === undefined) continue;

        const delta = Number(row.total) * direction; // -1 pays down, +1 restores
        const newBalance = Math.max(0, round2(Number(a.outstanding_balance) + delta));
        const patch = { outstanding_balance: newBalance, updated_by: actor };
        if (newBalance <= 0 && a.status === 'active') patch.status = 'completed';
        if (newBalance > 0 && a.status === 'completed') patch.status = 'active';
        await EmployeeComponentAssignment.query(trx).findById(a.id).patch(patch);
    }
};

// Atomic compare-and-swap on run.status. Throws 409 if a concurrent request moved it first.
const transitionRun = async (trx, runId, fromStates, patch) => {
    const changed = await PayrollRun.query(trx)
        .patch(patch)
        .where('id', runId)
        .whereIn('status', Array.isArray(fromStates) ? fromStates : [fromStates]);
    if (changed === 0) {
        throw Object.assign(new Error('The payroll run changed state — reload and try again.'), { status: 409 });
    }
    return PayrollRun.query(trx).findById(runId);
};

const { RUN_TYPES } = PayrollRun;

const findRun = (uuid, extra) => {
    let q = PayrollRun.query().findOne({ uuid }).where('is_deleted', false);
    if (extra) q = extra(q);
    return q;
};

const getAll = async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { status, run_type, pay_period_id } = req.query;

        let query = PayrollRun.query()
            .where('payroll.payroll_runs.is_deleted', false)
            .withGraphFetched('[period, approver]');

        if (status) query = query.where('status', status);
        if (run_type) query = query.where('run_type', run_type);
        if (pay_period_id) query = query.where('pay_period_id', pay_period_id);

        const result = await query
            .orderBy('created_at', 'desc')
            .range(offset, offset + limit - 1);

        return ok(res, result.results, { pagination: paginationMeta(result.total, page, limit) });
    } catch (error) {
        return serverError(res, 'run.getAll', error);
    }
};

const getByUuid = async (req, res) => {
    try {
        const run = await findRun(req.params.uuid, (q) => q.withGraphFetched('[period, approver]'));
        if (!run) return fail(res, 404, 'Payroll run not found.');

        const [slipCount, slipAgg] = await Promise.all([
            Payslip.query().where({ payroll_run_id: run.id, is_deleted: false }).resultSize(),
            Payslip.query()
                .where({ payroll_run_id: run.id, is_deleted: false })
                .select(Payslip.raw('COALESCE(SUM(net_pay),0) AS net'), Payslip.raw('COALESCE(SUM(gross_pay),0) AS gross'))
                .first(),
        ]);

        return ok(res, {
            ...run,
            payslip_count: slipCount,
            payslip_totals: { gross: Number(slipAgg?.gross || 0), net: Number(slipAgg?.net || 0) },
        });
    } catch (error) {
        return serverError(res, 'run.getByUuid', error);
    }
};

const create = async (req, res) => {
    try {
        const { pay_period_id, run_type = 'regular', notes } = req.body;

        if (!Number.isInteger(Number(pay_period_id)) || Number(pay_period_id) <= 0) {
            return fail(res, 400, 'pay_period_id must be a positive integer.');
        }
        if (!RUN_TYPES.includes(run_type)) {
            return fail(res, 400, `run_type must be one of: ${RUN_TYPES.join(', ')}`);
        }

        const period = await PayPeriod.query().findById(pay_period_id).where('is_deleted', false);
        if (!period) return fail(res, 404, 'Pay period not found.');
        if (period.status === 'closed') return fail(res, 409, 'Cannot create a run for a closed pay period.');

        // run_number auto-increments per (period, run_type)
        const last = await PayrollRun.query()
            .where({ pay_period_id, run_type })
            .max('run_number as maxNum')
            .first();
        const runNumber = (Number(last?.maxNum) || 0) + 1;

        const run = await PayrollRun.query()
            .insertAndFetch(definedOnly({
                pay_period_id: Number(pay_period_id),
                run_type,
                run_number: runNumber,
                status: 'draft',
                notes: trimOrNull(notes),
                created_by: actorId(req),
            }))
            .context(withActor(req));

        await logActivity({
            employeeId: actorId(req),
            action: 'payroll.run_created',
            category: 'payroll',
            description: `Created ${run_type} payroll run #${runNumber} for period "${period.name}"`,
            metadata: { run_uuid: run.uuid, pay_period_id },
            req,
        });

        return created(res, run);
    } catch (error) {
        return serverError(res, 'run.create', error);
    }
};

const update = async (req, res) => {
    try {
        const run = await findRun(req.params.uuid);
        if (!run) return fail(res, 404, 'Payroll run not found.');
        if (!['draft', 'calculated'].includes(run.status)) {
            return fail(res, 409, `A ${run.status} run cannot be edited.`);
        }

        const updated = await PayrollRun.query()
            .patchAndFetchById(run.id, definedOnly({
                notes: req.body.notes === undefined ? undefined : trimOrNull(req.body.notes),
                updated_by: actorId(req),
            }))
            .context(withActor(req));

        return ok(res, updated);
    } catch (error) {
        return serverError(res, 'run.update', error);
    }
};

/**
 * POST /payroll/runs/:uuid/calculate
 * body: { employee_ids?: number[] }
 */
const calculate = async (req, res) => {
    try {
        const run = await findRun(req.params.uuid);
        if (!run) return fail(res, 404, 'Payroll run not found.');

        let employeeIds = null;
        if (req.body.employee_ids !== undefined) {
            if (!Array.isArray(req.body.employee_ids)) return fail(res, 400, 'employee_ids must be an array.');
            employeeIds = req.body.employee_ids;
        }

        const result = await calculateRun(run.uuid, { employeeIds, actorId: actorId(req) });

        await logActivity({
            employeeId: actorId(req),
            action: 'payroll.run_calculated',
            category: 'payroll',
            description: `Calculated payroll run ${run.uuid}: ${result.processed_count} payslip(s), ${result.skipped.length} skipped`,
            metadata: { run_uuid: run.uuid, totals: result.totals },
            req,
        });

        return ok(res, result, {
            message: result.skipped.length
                ? `${result.processed_count} payslip(s) generated, ${result.skipped.length} employee(s) skipped.`
                : `${result.processed_count} payslip(s) generated.`,
        });
    } catch (error) {
        return serverError(res, 'run.calculate', error);
    }
};

const approve = async (req, res) => {
    try {
        const run = await findRun(req.params.uuid);
        if (!run) return fail(res, 404, 'Payroll run not found.');
        if (run.status === 'approved') return fail(res, 409, 'This run is already approved.');
        if (!PayrollRun.canTransition(run.status, 'approved')) {
            return fail(res, 409, `A ${run.status} run cannot be approved.`);
        }

        const slipCount = await Payslip.query().where({ payroll_run_id: run.id, is_deleted: false }).resultSize();
        if (slipCount === 0) return fail(res, 409, 'Calculate the run before approving it.');

        const updated = await Model.transaction(async (trx) => {
            const r = await transitionRun(trx, run.id, ['calculated'], {
                status: 'approved',
                approved_by: actorId(req),
                approved_at: new Date().toISOString(),
                updated_by: actorId(req),
            });

            await PayPeriod.query(trx)
                .patch({ status: 'locked', updated_by: actorId(req) })
                .where({ id: run.pay_period_id })
                .whereNot('status', 'closed');

            // Loan balances move exactly once — here, at approval.
            await amortizeRunLoans(trx, run.id, -1, actorId(req));

            return r;
        });

        await logActivity({
            employeeId: actorId(req),
            action: 'payroll.run_approved',
            category: 'payroll',
            description: `Approved payroll run ${run.uuid} (${slipCount} payslips, net ${updated.total_net})`,
            metadata: { run_uuid: run.uuid },
            req,
        });

        // Best-effort email to every employee with a payslip in this run — the
        // fan-out runs in the background and never blocks the response.
        notifyPayrollRunApproved({ runId: run.id });

        return ok(res, updated, { message: 'Payroll run approved.' });
    } catch (error) {
        return serverError(res, 'run.approve', error);
    }
};

const markPaid = async (req, res) => {
    try {
        const run = await findRun(req.params.uuid);
        if (!run) return fail(res, 404, 'Payroll run not found.');
        if (!PayrollRun.canTransition(run.status, 'paid')) {
            return fail(res, 409, `A ${run.status} run cannot be marked paid.`);
        }

        const reference = trimOrNull(req.body.payment_reference);

        const updated = await Model.transaction(async (trx) => {
            const r = await transitionRun(trx, run.id, ['approved'], {
                status: 'paid',
                paid_by: actorId(req),
                paid_at: new Date().toISOString(),
                updated_by: actorId(req),
            });

            await Payslip.query(trx)
                .patch(definedOnly({
                    status: 'released',
                    released_at: new Date().toISOString(),
                    payment_reference: reference === null ? undefined : reference,
                    updated_by: actorId(req),
                }))
                .where({ payroll_run_id: run.id, is_deleted: false })
                .whereIn('status', ['calculated', 'draft']);

            return r;
        });

        await logActivity({
            employeeId: actorId(req),
            action: 'payroll.run_paid',
            category: 'payroll',
            description: `Marked payroll run ${run.uuid} as paid`,
            metadata: { run_uuid: run.uuid, payment_reference: reference },
            req,
        });

        return ok(res, updated, { message: 'Payroll run marked as paid; payslips released.' });
    } catch (error) {
        return serverError(res, 'run.markPaid', error);
    }
};

const cancel = async (req, res) => {
    try {
        const run = await findRun(req.params.uuid);
        if (!run) return fail(res, 404, 'Payroll run not found.');
        if (run.status === 'paid') return fail(res, 409, 'A paid payroll run cannot be cancelled.');
        if (run.status === 'cancelled') return fail(res, 409, 'This run is already cancelled.');

        const updated = await Model.transaction(async (trx) => {
            const r = await transitionRun(trx, run.id, ['draft', 'calculating', 'calculated', 'approved'], {
                status: 'cancelled',
                updated_by: actorId(req),
            });

            // If loans were already paid down at approval, put the balances back.
            if (run.status === 'approved') await amortizeRunLoans(trx, run.id, +1, actorId(req));

            await Payslip.query(trx)
                .patch({ status: 'cancelled', updated_by: actorId(req) })
                .where({ payroll_run_id: run.id, is_deleted: false });

            return r;
        });

        await logActivity({
            employeeId: actorId(req),
            action: 'payroll.run_cancelled',
            category: 'payroll',
            description: `Cancelled payroll run ${run.uuid}`,
            metadata: { run_uuid: run.uuid },
            req,
        });

        return ok(res, updated, { message: 'Payroll run cancelled.' });
    } catch (error) {
        return serverError(res, 'run.cancel', error);
    }
};

const remove = async (req, res) => {
    try {
        const run = await findRun(req.params.uuid);
        if (!run) return fail(res, 404, 'Payroll run not found.');
        if (['approved', 'paid'].includes(run.status)) {
            return fail(res, 409, `A ${run.status} run cannot be deleted. Cancel it instead.`);
        }

        await Model.transaction(async (trx) => {
            await transitionRun(trx, run.id, ['draft', 'calculating', 'calculated'], {
                is_deleted: true, status: 'cancelled', updated_by: actorId(req),
            });
            await Payslip.query(trx)
                .patch({ is_deleted: true, status: 'cancelled', updated_by: actorId(req) })
                .where({ payroll_run_id: run.id });
        });

        await logActivity({
            employeeId: actorId(req),
            action: 'payroll.run_archived',
            category: 'payroll',
            description: `Archived payroll run ${run.uuid}`,
            metadata: { run_uuid: run.uuid },
            req,
        });

        return ok(res, { uuid: run.uuid }, { message: 'Payroll run archived.' });
    } catch (error) {
        return serverError(res, 'run.remove', error);
    }
};

module.exports = { getAll, getByUuid, create, update, calculate, approve, markPaid, cancel, remove };
