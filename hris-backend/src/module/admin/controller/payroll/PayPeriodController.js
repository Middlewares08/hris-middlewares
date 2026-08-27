// src/module/admin/controller/payroll/PayPeriodController.js
const PayPeriod = require('../../../../database/models/payroll/PayPeriod');
const PayrollRun = require('../../../../database/models/payroll/PayrollRun');
const { logActivity } = require('../../../../utils/activityLogger');
const {
    actorId, withActor, ok, created, fail, serverError,
    parsePagination, paginationMeta, isValidDate, trimOrNull, definedOnly,
} = require('./_helpers');

const { FREQUENCIES, SEQUENCES, STATUSES } = PayPeriod;

const validate = (body, { partial = false } = {}) => {
    const { name, period_start, period_end, pay_date, frequency, sequence, status } = body;

    if (!partial || name !== undefined) {
        if (!trimOrNull(name)) return 'name is required.';
    }
    if (!partial || period_start !== undefined) {
        if (!isValidDate(period_start)) return 'period_start must be a valid YYYY-MM-DD date.';
    }
    if (!partial || period_end !== undefined) {
        if (!isValidDate(period_end)) return 'period_end must be a valid YYYY-MM-DD date.';
    }
    if (!partial || pay_date !== undefined) {
        if (!isValidDate(pay_date)) return 'pay_date must be a valid YYYY-MM-DD date.';
    }
    if (period_start && period_end && isValidDate(period_start) && isValidDate(period_end) && String(period_end) < String(period_start)) {
        return 'period_end cannot be earlier than period_start.';
    }
    if (frequency !== undefined && !FREQUENCIES.includes(frequency)) return `frequency must be one of: ${FREQUENCIES.join(', ')}`;
    if (sequence !== undefined && !SEQUENCES.includes(sequence)) return `sequence must be one of: ${SEQUENCES.join(', ')}`;
    if (status !== undefined && !STATUSES.includes(status)) return `status must be one of: ${STATUSES.join(', ')}`;
    return null;
};

const getAll = async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { status, frequency, date_from, date_to } = req.query;

        let query = PayPeriod.query().where('is_deleted', false);
        if (status) query = query.where('status', status);
        if (frequency) query = query.where('frequency', frequency);
        if (date_from) query = query.where('period_end', '>=', date_from);
        if (date_to) query = query.where('period_start', '<=', date_to);

        const result = await query
            .orderBy('period_start', 'desc')
            .range(offset, offset + limit - 1);

        return ok(res, result.results, { pagination: paginationMeta(result.total, page, limit) });
    } catch (error) {
        return serverError(res, 'period.getAll', error);
    }
};

const getByUuid = async (req, res) => {
    try {
        const row = await PayPeriod.query()
            .findOne({ uuid: req.params.uuid })
            .where('is_deleted', false)
            .withGraphFetched('runs(notDeleted)')
            .modifiers({ notDeleted: (b) => b.where('payroll.payroll_runs.is_deleted', false).orderBy('run_number', 'asc') });
        if (!row) return fail(res, 404, 'Pay period not found.');
        return ok(res, row);
    } catch (error) {
        return serverError(res, 'period.getByUuid', error);
    }
};

const create = async (req, res) => {
    try {
        const err = validate(req.body);
        if (err) return fail(res, 400, err);

        const frequency = req.body.frequency || 'semi_monthly';
        const sequence = req.body.sequence || 'monthly';

        const dupe = await PayPeriod.query().findOne({
            period_start: req.body.period_start,
            period_end: req.body.period_end,
            frequency,
            sequence,
        });
        if (dupe) return fail(res, 409, 'A pay period with the same date range, frequency and sequence already exists.');

        const row = await PayPeriod.query()
            .insertAndFetch(definedOnly({
                name: String(req.body.name).trim(),
                period_start: req.body.period_start,
                period_end: req.body.period_end,
                pay_date: req.body.pay_date,
                frequency,
                sequence,
                status: req.body.status || 'open',
                remarks: trimOrNull(req.body.remarks),
                created_by: actorId(req),
            }))
            .context(withActor(req));

        await logActivity({
            employeeId: actorId(req),
            action: 'payroll.period_created',
            category: 'payroll',
            description: `Created pay period "${row.name}" (${row.period_start} → ${row.period_end})`,
            metadata: { period_uuid: row.uuid },
            req,
        });

        return created(res, row);
    } catch (error) {
        return serverError(res, 'period.create', error);
    }
};

const update = async (req, res) => {
    try {
        const row = await PayPeriod.query().findOne({ uuid: req.params.uuid }).where('is_deleted', false);
        if (!row) return fail(res, 404, 'Pay period not found.');

        const err = validate(req.body, { partial: true });
        if (err) return fail(res, 400, err);

        if (row.status === 'closed' && req.body.status !== 'open') {
            return fail(res, 409, 'A closed pay period is locked. Reopen it first to make changes.');
        }

        const nextStart = req.body.period_start ?? row.period_start;
        const nextEnd = req.body.period_end ?? row.period_end;
        if (String(nextEnd) < String(nextStart)) return fail(res, 400, 'period_end cannot be earlier than period_start.');

        const updated = await PayPeriod.query()
            .patchAndFetchById(row.id, definedOnly({
                name: req.body.name === undefined ? undefined : String(req.body.name).trim(),
                period_start: req.body.period_start,
                period_end: req.body.period_end,
                pay_date: req.body.pay_date,
                frequency: req.body.frequency,
                sequence: req.body.sequence,
                status: req.body.status,
                remarks: req.body.remarks === undefined ? undefined : trimOrNull(req.body.remarks),
                updated_by: actorId(req),
            }))
            .context(withActor(req));

        await logActivity({
            employeeId: actorId(req),
            action: 'payroll.period_updated',
            category: 'payroll',
            description: `Updated pay period "${updated.name}"`,
            metadata: { period_uuid: updated.uuid, status: updated.status },
            req,
        });

        return ok(res, updated);
    } catch (error) {
        return serverError(res, 'period.update', error);
    }
};

const remove = async (req, res) => {
    try {
        const row = await PayPeriod.query().findOne({ uuid: req.params.uuid }).where('is_deleted', false);
        if (!row) return fail(res, 404, 'Pay period not found.');

        const activeRuns = await PayrollRun.query()
            .where({ pay_period_id: row.id, is_deleted: false })
            .whereNot('status', 'cancelled')
            .resultSize();
        if (activeRuns > 0) {
            return fail(res, 409, `This pay period has ${activeRuns} active payroll run(s). Cancel them first.`);
        }

        await PayPeriod.query().patchAndFetchById(row.id, {
            is_deleted: true, status: 'closed', updated_by: actorId(req),
        }).context(withActor(req));

        await logActivity({
            employeeId: actorId(req),
            action: 'payroll.period_archived',
            category: 'payroll',
            description: `Archived pay period "${row.name}"`,
            metadata: { period_uuid: row.uuid },
            req,
        });

        return ok(res, { uuid: row.uuid }, { message: 'Pay period archived.' });
    } catch (error) {
        return serverError(res, 'period.remove', error);
    }
};

module.exports = { getAll, getByUuid, create, update, remove };
