// src/module/admin/controller/payroll/StatutoryTableController.js
const { Model } = require('objection');
const StatutoryTable = require('../../../../database/models/payroll/StatutoryTable');
const StatutoryBracket = require('../../../../database/models/payroll/StatutoryBracket');
const { logActivity } = require('../../../../utils/activityLogger');
const {
    actorId, withActor, ok, created, fail, serverError,
    parsePagination, paginationMeta, isValidDate, toBool, trimOrNull, definedOnly,
} = require('./_helpers');

const { TYPES, FREQUENCIES, COMPUTATION_TYPES } = StatutoryTable;

// null when blank, otherwise a finite number (or the string is rejected upstream by validate)
const num = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};
const isNumericOrBlank = (v) => v === '' || v === null || v === undefined || Number.isFinite(Number(v));

const withBrackets = (q) => q
    .withGraphFetched('brackets')
    .modifyGraph('brackets', (b) => b.where('payroll.statutory_brackets.is_deleted', false).orderBy('sort_order', 'asc'));

const validate = (body, { partial = false } = {}) => {
    const { type, label, effective_from, effective_to, frequency, computation_type, brackets } = body;

    if (!partial || type !== undefined) {
        if (!TYPES.includes(type)) return `type must be one of: ${TYPES.join(', ')}`;
    }
    if (!partial || label !== undefined) {
        if (!trimOrNull(label)) return 'label is required.';
    }
    if (!partial || effective_from !== undefined) {
        if (!isValidDate(effective_from)) return 'effective_from must be a valid YYYY-MM-DD date.';
    }
    if (effective_to !== undefined && effective_to !== null && effective_to !== '' && !isValidDate(effective_to)) {
        return 'effective_to must be a valid YYYY-MM-DD date.';
    }
    if (effective_from && effective_to && isValidDate(effective_to) && String(effective_to) < String(effective_from)) {
        return 'effective_to cannot be earlier than effective_from.';
    }
    if (frequency !== undefined && !FREQUENCIES.includes(frequency)) {
        return `frequency must be one of: ${FREQUENCIES.join(', ')}`;
    }
    if (computation_type !== undefined && !COMPUTATION_TYPES.includes(computation_type)) {
        return `computation_type must be one of: ${COMPUTATION_TYPES.join(', ')}`;
    }
    for (const k of ['employee_rate', 'employer_rate', 'salary_floor', 'salary_ceiling', 'salary_rounding', 'ec_amount']) {
        if (body[k] !== undefined && !isNumericOrBlank(body[k])) return `${k} must be a number.`;
    }
    if (brackets !== undefined) {
        if (!Array.isArray(brackets)) return 'brackets must be an array.';
        for (const b of brackets) {
            if (!Number.isFinite(Number(b.lower_bound))) return 'Each bracket needs a numeric lower bound.';
            if (b.upper_bound !== '' && b.upper_bound !== null && b.upper_bound !== undefined && !Number.isFinite(Number(b.upper_bound))) {
                return 'Bracket upper bound must be a number or blank.';
            }
            for (const k of ['employee_amount', 'employer_amount', 'ec_amount', 'employee_rate', 'employer_rate', 'base_tax', 'tax_rate']) {
                if (b[k] !== undefined && !isNumericOrBlank(b[k])) return `Bracket ${k} must be a number.`;
            }
        }
    }
    return null;
};

// Shape a request bracket into a DB row for the given computation type.
const shapeBracket = (b, method, i, actor) => ({
    lower_bound: Number(b.lower_bound) || 0,
    upper_bound: b.upper_bound === '' || b.upper_bound === null || b.upper_bound === undefined ? null : Number(b.upper_bound),
    employee_amount: method === 'fixed_bracket' ? num(b.employee_amount) : null,
    employer_amount: method === 'fixed_bracket' ? num(b.employer_amount) : null,
    ec_amount: method === 'fixed_bracket' ? num(b.ec_amount) : null,
    employee_rate: method === 'tiered_percentage' ? num(b.employee_rate) : null,
    employer_rate: method === 'tiered_percentage' ? num(b.employer_rate) : null,
    base_tax: method === 'tax_bracket' ? num(b.base_tax) : null,
    tax_rate: method === 'tax_bracket' ? num(b.tax_rate) : null,
    sort_order: i,
    created_by: actor,
    updated_by: actor,
});

const scalarFields = (body) => ({
    employee_rate: num(body.employee_rate),
    employer_rate: num(body.employer_rate),
    salary_floor: num(body.salary_floor),
    salary_ceiling: num(body.salary_ceiling),
    salary_rounding: num(body.salary_rounding),
    ec_amount: num(body.ec_amount),
});

const getAll = async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { type, is_active } = req.query;

        let query = withBrackets(StatutoryTable.query().where('is_deleted', false));
        if (type) query = query.where('type', type);
        if (is_active !== undefined) query = query.where('is_active', toBool(is_active));

        const result = await query
            .orderBy('type', 'asc')
            .orderBy('effective_from', 'desc')
            .range(offset, offset + limit - 1);

        return ok(res, result.results, { pagination: paginationMeta(result.total, page, limit) });
    } catch (error) {
        return serverError(res, 'statutory.getAll', error);
    }
};

const getByUuid = async (req, res) => {
    try {
        const row = await withBrackets(StatutoryTable.query().findOne({ uuid: req.params.uuid }).where('is_deleted', false));
        if (!row) return fail(res, 404, 'Statutory table not found.');
        return ok(res, row);
    } catch (error) {
        return serverError(res, 'statutory.getByUuid', error);
    }
};

const create = async (req, res) => {
    try {
        const err = validate(req.body);
        if (err) return fail(res, 400, err);

        const method = req.body.computation_type || 'flat_percentage';
        const actor = actorId(req);

        const row = await Model.transaction(async (trx) => {
            const table = await StatutoryTable.query(trx)
                .insertAndFetch(definedOnly({
                    type: req.body.type,
                    label: String(req.body.label).trim(),
                    effective_from: req.body.effective_from,
                    effective_to: trimOrNull(req.body.effective_to),
                    frequency: req.body.frequency || 'monthly',
                    computation_type: method,
                    ...scalarFields(req.body),
                    is_active: req.body.is_active === undefined ? true : toBool(req.body.is_active),
                    created_by: actor,
                }))
                .context(withActor(req));

            const brackets = Array.isArray(req.body.brackets) ? req.body.brackets : [];
            if (brackets.length) {
                await StatutoryBracket.query(trx).insert(
                    brackets.map((b, i) => ({ ...shapeBracket(b, method, i, actor), statutory_table_id: table.id })),
                );
            }
            return table;
        });

        const full = await withBrackets(StatutoryTable.query().findById(row.id));

        await logActivity({
            employeeId: actor,
            action: 'payroll.statutory_created',
            category: 'payroll',
            description: `Created ${full.type} statutory table "${full.label}"`,
            metadata: { statutory_uuid: full.uuid, type: full.type, computation_type: full.computation_type },
            req,
        });

        return created(res, full);
    } catch (error) {
        return serverError(res, 'statutory.create', error);
    }
};

const update = async (req, res) => {
    try {
        const row = await StatutoryTable.query().findOne({ uuid: req.params.uuid }).where('is_deleted', false);
        if (!row) return fail(res, 404, 'Statutory table not found.');

        const err = validate(req.body, { partial: true });
        if (err) return fail(res, 400, err);

        const method = req.body.computation_type ?? row.computation_type;
        const actor = actorId(req);

        await Model.transaction(async (trx) => {
            await StatutoryTable.query(trx)
                .patchAndFetchById(row.id, definedOnly({
                    type: req.body.type,
                    label: req.body.label === undefined ? undefined : String(req.body.label).trim(),
                    effective_from: req.body.effective_from,
                    effective_to: req.body.effective_to === undefined ? undefined : trimOrNull(req.body.effective_to),
                    frequency: req.body.frequency,
                    computation_type: req.body.computation_type,
                    employee_rate: req.body.employee_rate === undefined ? undefined : num(req.body.employee_rate),
                    employer_rate: req.body.employer_rate === undefined ? undefined : num(req.body.employer_rate),
                    salary_floor: req.body.salary_floor === undefined ? undefined : num(req.body.salary_floor),
                    salary_ceiling: req.body.salary_ceiling === undefined ? undefined : num(req.body.salary_ceiling),
                    salary_rounding: req.body.salary_rounding === undefined ? undefined : num(req.body.salary_rounding),
                    ec_amount: req.body.ec_amount === undefined ? undefined : num(req.body.ec_amount),
                    is_active: req.body.is_active === undefined ? undefined : toBool(req.body.is_active),
                    updated_by: actor,
                }))
                .context(withActor(req));

            // Full replace of bracket rows when the caller sends a brackets array.
            if (Array.isArray(req.body.brackets)) {
                await StatutoryBracket.query(trx).delete().where('statutory_table_id', row.id);
                if (req.body.brackets.length) {
                    await StatutoryBracket.query(trx).insert(
                        req.body.brackets.map((b, i) => ({ ...shapeBracket(b, method, i, actor), statutory_table_id: row.id })),
                    );
                }
            }
        });

        const full = await withBrackets(StatutoryTable.query().findById(row.id));

        await logActivity({
            employeeId: actor,
            action: 'payroll.statutory_updated',
            category: 'payroll',
            description: `Updated ${full.type} statutory table "${full.label}"`,
            metadata: { statutory_uuid: full.uuid },
            req,
        });

        return ok(res, full);
    } catch (error) {
        return serverError(res, 'statutory.update', error);
    }
};

const remove = async (req, res) => {
    try {
        const row = await StatutoryTable.query().findOne({ uuid: req.params.uuid }).where('is_deleted', false);
        if (!row) return fail(res, 404, 'Statutory table not found.');

        await StatutoryTable.query().patchAndFetchById(row.id, {
            is_deleted: true, is_active: false, updated_by: actorId(req),
        }).context(withActor(req));

        await logActivity({
            employeeId: actorId(req),
            action: 'payroll.statutory_archived',
            category: 'payroll',
            description: `Archived ${row.type} statutory table "${row.label}"`,
            metadata: { statutory_uuid: row.uuid },
            req,
        });

        return ok(res, { uuid: row.uuid }, { message: 'Statutory table archived.' });
    } catch (error) {
        return serverError(res, 'statutory.remove', error);
    }
};

module.exports = { getAll, getByUuid, create, update, remove };
