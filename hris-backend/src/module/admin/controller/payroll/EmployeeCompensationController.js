// src/module/admin/controller/payroll/EmployeeCompensationController.js
const EmployeeCompensation = require('../../../../database/models/payroll/EmployeeCompensation');
const Employee = require('../../../../database/models/employee/Employee');
const { logActivity } = require('../../../../utils/activityLogger');
const {
    actorId, withActor, ok, created, fail, serverError,
    parsePagination, paginationMeta, isValidDate, isValidNumber, toBool, trimOrNull, definedOnly,
} = require('./_helpers');

const { RATE_TYPES, PAY_FREQUENCIES, PAYMENT_METHODS } = EmployeeCompensation;

// crypto.js loads its key at require-time; guard so a missing key can never crash the route.
let cryptoUtil = null;
try { cryptoUtil = require('../../../../utils/crypto'); } catch (_) { cryptoUtil = null; }
const encryptSecret = (v) => {
    const s = trimOrNull(v);
    if (!s) return null;
    try { return cryptoUtil ? cryptoUtil.encrypt(s) : s; } catch (_) { return s; }
};
const decryptSecret = (v) => {
    if (!v) return null;
    try { return cryptoUtil ? cryptoUtil.decrypt(String(v)) : String(v); } catch (_) { return null; }
};
const maskAccount = (plain) => {
    if (!plain) return null;
    const s = String(plain);
    return s.length <= 4 ? '••••' : `••••${s.slice(-4)}`;
};

// Never expose the encrypted blob; expose a masked hint instead.
const present = (row) => {
    if (!row) return row;
    const json = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
    const plain = decryptSecret(json.bank_account_number);
    delete json.bank_account_number;
    json.bank_account_last4 = maskAccount(plain);
    return json;
};

const validate = (body, { partial = false } = {}) => {
    const { employee_id, pay_rate, rate_type, pay_frequency, payment_method, effective_date, end_date } = body;

    if (!partial || employee_id !== undefined) {
        if (!Number.isInteger(Number(employee_id)) || Number(employee_id) <= 0) return 'employee_id must be a positive integer.';
    }
    if (!partial || pay_rate !== undefined) {
        if (!isValidNumber(pay_rate) || Number(pay_rate) < 0) return 'pay_rate must be a non-negative number.';
    }
    if (rate_type !== undefined && !RATE_TYPES.includes(rate_type)) {
        return `rate_type must be one of: ${RATE_TYPES.join(', ')}`;
    }
    if (pay_frequency !== undefined && !PAY_FREQUENCIES.includes(pay_frequency)) {
        return `pay_frequency must be one of: ${PAY_FREQUENCIES.join(', ')}`;
    }
    if (payment_method !== undefined && !PAYMENT_METHODS.includes(payment_method)) {
        return `payment_method must be one of: ${PAYMENT_METHODS.join(', ')}`;
    }
    if (!partial || effective_date !== undefined) {
        if (!isValidDate(effective_date)) return 'effective_date must be a valid YYYY-MM-DD date.';
    }
    if (end_date !== undefined && end_date !== null && end_date !== '' && !isValidDate(end_date)) {
        return 'end_date must be a valid YYYY-MM-DD date.';
    }
    if (effective_date && end_date && isValidDate(end_date) && String(end_date) < String(effective_date)) {
        return 'end_date cannot be earlier than effective_date.';
    }
    for (const k of ['working_days_per_month', 'working_hours_per_day', 'monthly_equivalent']) {
        if (body[k] !== undefined && body[k] !== null && (!isValidNumber(body[k]) || Number(body[k]) < 0)) {
            return `${k} must be a non-negative number.`;
        }
    }
    return null;
};

const getAll = async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { employee_id, is_active, search } = req.query;

        let query = EmployeeCompensation.query()
            .where('payroll.employee_compensations.is_deleted', false)
            .withGraphFetched('employee');

        if (employee_id) query = query.where('employee_id', employee_id);
        if (is_active !== undefined) query = query.where('is_active', toBool(is_active));
        if (search) {
            query = query.whereExists(
                EmployeeCompensation.relatedQuery('employee').where((b) => {
                    b.where('first_name', 'ilike', `%${search}%`).orWhere('last_name', 'ilike', `%${search}%`);
                }),
            );
        }

        const result = await query
            .orderBy('effective_date', 'desc')
            .range(offset, offset + limit - 1);

        return ok(res, result.results.map(present), { pagination: paginationMeta(result.total, page, limit) });
    } catch (error) {
        return serverError(res, 'compensation.getAll', error);
    }
};

const getByUuid = async (req, res) => {
    try {
        const row = await EmployeeCompensation.query()
            .findOne({ uuid: req.params.uuid })
            .where('is_deleted', false)
            .withGraphFetched('employee');
        if (!row) return fail(res, 404, 'Compensation record not found.');
        return ok(res, present(row));
    } catch (error) {
        return serverError(res, 'compensation.getByUuid', error);
    }
};

const getActiveForEmployee = async (req, res) => {
    try {
        const employeeId = Number(req.params.employee_id);
        if (!Number.isInteger(employeeId) || employeeId <= 0) return fail(res, 400, 'Invalid employee_id.');
        const onDate = req.query.on_date || new Date().toISOString().substring(0, 10);
        const row = await EmployeeCompensation.activeForEmployee(employeeId, onDate);
        if (!row) return fail(res, 404, 'No active compensation record for this employee.');
        return ok(res, present(row));
    } catch (error) {
        return serverError(res, 'compensation.getActiveForEmployee', error);
    }
};

const create = async (req, res) => {
    try {
        const err = validate(req.body);
        if (err) return fail(res, 400, err);

        const employee = await Employee.query().findById(req.body.employee_id).where('is_deleted', false);
        if (!employee) return fail(res, 404, 'Employee not found.');

        const rateType = req.body.rate_type || 'monthly';
        const workingDays = isValidNumber(req.body.working_days_per_month) ? Number(req.body.working_days_per_month) : 22;
        const workingHours = isValidNumber(req.body.working_hours_per_day) ? Number(req.body.working_hours_per_day) : 8;
        const monthlyEquivalent = isValidNumber(req.body.monthly_equivalent)
            ? Number(req.body.monthly_equivalent)
            : EmployeeCompensation.deriveMonthlyEquivalent({
                pay_rate: req.body.pay_rate, rate_type: rateType,
                working_days_per_month: workingDays, working_hours_per_day: workingHours,
            });

        const makeActive = req.body.is_active === undefined ? true : toBool(req.body.is_active);

        const row = await EmployeeCompensation.transaction(async (trx) => {
            // One active record per employee — supersede the current one.
            if (makeActive) {
                await EmployeeCompensation.query(trx)
                    .patch({
                        is_active: false,
                        // close the superseded record the day before the new one starts
                        end_date: EmployeeCompensation.raw('LEAST(COALESCE(end_date, ?::date - 1), ?::date - 1)', [req.body.effective_date, req.body.effective_date]),
                        updated_by: actorId(req),
                    })
                    .where({ employee_id: req.body.employee_id, is_active: true, is_deleted: false });
            }

            return EmployeeCompensation.query(trx)
                .insertAndFetch(definedOnly({
                    employee_id: Number(req.body.employee_id),
                    pay_rate: Number(req.body.pay_rate),
                    rate_type: rateType,
                    monthly_equivalent: monthlyEquivalent,
                    working_days_per_month: workingDays,
                    working_hours_per_day: workingHours,
                    pay_frequency: req.body.pay_frequency || 'semi_monthly',
                    currency: trimOrNull(req.body.currency) || 'PHP',
                    tax_status: trimOrNull(req.body.tax_status),
                    is_minimum_wage_earner: toBool(req.body.is_minimum_wage_earner),
                    is_tax_exempt: toBool(req.body.is_tax_exempt),
                    payment_method: req.body.payment_method || 'bank_transfer',
                    bank_name: trimOrNull(req.body.bank_name),
                    bank_account_name: trimOrNull(req.body.bank_account_name),
                    bank_account_number: encryptSecret(req.body.bank_account_number),
                    effective_date: req.body.effective_date,
                    end_date: trimOrNull(req.body.end_date),
                    is_active: makeActive,
                    remarks: trimOrNull(req.body.remarks),
                    created_by: actorId(req),
                }))
                .context(withActor(req));
        });

        await logActivity({
            employeeId: row.employee_id,
            action: 'payroll.compensation_set',
            category: 'payroll',
            description: `Compensation set: ${row.currency} ${row.pay_rate} / ${row.rate_type} effective ${row.effective_date}`,
            metadata: { compensation_uuid: row.uuid, monthly_equivalent: row.monthly_equivalent },
            req,
        });

        return created(res, present(row));
    } catch (error) {
        return serverError(res, 'compensation.create', error);
    }
};

const update = async (req, res) => {
    try {
        const row = await EmployeeCompensation.query().findOne({ uuid: req.params.uuid }).where('is_deleted', false);
        if (!row) return fail(res, 404, 'Compensation record not found.');

        const err = validate({ ...req.body, employee_id: req.body.employee_id ?? row.employee_id }, { partial: true });
        if (err) return fail(res, 400, err);

        const rateType = req.body.rate_type ?? row.rate_type;
        const workingDays = req.body.working_days_per_month ?? row.working_days_per_month;
        const workingHours = req.body.working_hours_per_day ?? row.working_hours_per_day;
        const payRate = req.body.pay_rate ?? row.pay_rate;

        // Recompute the normalized monthly figure unless the caller pinned one explicitly.
        const monthlyEquivalent = isValidNumber(req.body.monthly_equivalent)
            ? Number(req.body.monthly_equivalent)
            : EmployeeCompensation.deriveMonthlyEquivalent({
                pay_rate: payRate, rate_type: rateType,
                working_days_per_month: workingDays, working_hours_per_day: workingHours,
            });

        const patch = definedOnly({
            pay_rate: req.body.pay_rate === undefined ? undefined : Number(req.body.pay_rate),
            rate_type: req.body.rate_type,
            monthly_equivalent: monthlyEquivalent,
            working_days_per_month: req.body.working_days_per_month === undefined ? undefined : Number(req.body.working_days_per_month),
            working_hours_per_day: req.body.working_hours_per_day === undefined ? undefined : Number(req.body.working_hours_per_day),
            pay_frequency: req.body.pay_frequency,
            currency: req.body.currency === undefined ? undefined : (trimOrNull(req.body.currency) || 'PHP'),
            tax_status: req.body.tax_status === undefined ? undefined : trimOrNull(req.body.tax_status),
            is_minimum_wage_earner: req.body.is_minimum_wage_earner === undefined ? undefined : toBool(req.body.is_minimum_wage_earner),
            is_tax_exempt: req.body.is_tax_exempt === undefined ? undefined : toBool(req.body.is_tax_exempt),
            payment_method: req.body.payment_method,
            bank_name: req.body.bank_name === undefined ? undefined : trimOrNull(req.body.bank_name),
            bank_account_name: req.body.bank_account_name === undefined ? undefined : trimOrNull(req.body.bank_account_name),
            bank_account_number: req.body.bank_account_number === undefined ? undefined : encryptSecret(req.body.bank_account_number),
            effective_date: req.body.effective_date,
            end_date: req.body.end_date === undefined ? undefined : trimOrNull(req.body.end_date),
            is_active: req.body.is_active === undefined ? undefined : toBool(req.body.is_active),
            remarks: req.body.remarks === undefined ? undefined : trimOrNull(req.body.remarks),
            updated_by: actorId(req),
        });

        const updated = await EmployeeCompensation.query()
            .patchAndFetchById(row.id, patch)
            .context(withActor(req));

        await logActivity({
            employeeId: updated.employee_id,
            action: 'payroll.compensation_updated',
            category: 'payroll',
            description: `Compensation record updated (effective ${updated.effective_date})`,
            metadata: { compensation_uuid: updated.uuid },
            req,
        });

        return ok(res, present(updated));
    } catch (error) {
        return serverError(res, 'compensation.update', error);
    }
};

const remove = async (req, res) => {
    try {
        const row = await EmployeeCompensation.query().findOne({ uuid: req.params.uuid }).where('is_deleted', false);
        if (!row) return fail(res, 404, 'Compensation record not found.');

        await EmployeeCompensation.query().patchAndFetchById(row.id, {
            is_deleted: true, is_active: false, updated_by: actorId(req),
        }).context(withActor(req));

        await logActivity({
            employeeId: row.employee_id,
            action: 'payroll.compensation_archived',
            category: 'payroll',
            description: `Compensation record archived (effective ${row.effective_date})`,
            metadata: { compensation_uuid: row.uuid },
            req,
        });

        return ok(res, { uuid: row.uuid }, { message: 'Compensation record archived.' });
    } catch (error) {
        return serverError(res, 'compensation.remove', error);
    }
};

module.exports = { getAll, getByUuid, getActiveForEmployee, create, update, remove };
