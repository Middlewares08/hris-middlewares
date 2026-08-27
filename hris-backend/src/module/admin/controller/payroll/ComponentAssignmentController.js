// src/module/admin/controller/payroll/ComponentAssignmentController.js
const EmployeeComponentAssignment = require('../../../../database/models/payroll/EmployeeComponentAssignment');
const PayComponent = require('../../../../database/models/payroll/PayComponent');
const Employee = require('../../../../database/models/employee/Employee');
const { logActivity } = require('../../../../utils/activityLogger');
const {
    actorId, withActor, ok, created, fail, serverError,
    parsePagination, paginationMeta, isValidDate, isValidNumber, trimOrNull, definedOnly,
} = require('./_helpers');

const { STATUSES } = EmployeeComponentAssignment;

const validate = (body, { partial = false } = {}) => {
    const { employee_id, component_id, amount, rate, start_date, end_date, status } = body;

    if (!partial || employee_id !== undefined) {
        if (!Number.isInteger(Number(employee_id)) || Number(employee_id) <= 0) return 'employee_id must be a positive integer.';
    }
    if (!partial || component_id !== undefined) {
        if (!Number.isInteger(Number(component_id)) || Number(component_id) <= 0) return 'component_id must be a positive integer.';
    }
    if (!partial || start_date !== undefined) {
        if (!isValidDate(start_date)) return 'start_date must be a valid YYYY-MM-DD date.';
    }
    if (end_date !== undefined && end_date !== null && end_date !== '' && !isValidDate(end_date)) {
        return 'end_date must be a valid YYYY-MM-DD date.';
    }
    if (start_date && end_date && isValidDate(end_date) && String(end_date) < String(start_date)) {
        return 'end_date cannot be earlier than start_date.';
    }
    if (status !== undefined && !STATUSES.includes(status)) {
        return `status must be one of: ${STATUSES.join(', ')}`;
    }
    for (const [k, v] of Object.entries({ amount, rate })) {
        if (v !== undefined && v !== null && v !== '' && !isValidNumber(v)) return `${k} must be numeric.`;
    }
    for (const k of ['principal_amount', 'outstanding_balance', 'installment_amount']) {
        if (body[k] !== undefined && body[k] !== null && body[k] !== '' && (!isValidNumber(body[k]) || Number(body[k]) < 0)) {
            return `${k} must be a non-negative number.`;
        }
    }
    return null;
};

const getAll = async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { employee_id, component_id, status } = req.query;

        let query = EmployeeComponentAssignment.query()
            .where('payroll.employee_component_assignments.is_deleted', false)
            .withGraphFetched('[employee, component]');

        if (employee_id) query = query.where('employee_id', employee_id);
        if (component_id) query = query.where('component_id', component_id);
        if (status) query = query.where('status', status);

        const result = await query
            .orderBy('start_date', 'desc')
            .range(offset, offset + limit - 1);

        return ok(res, result.results, { pagination: paginationMeta(result.total, page, limit) });
    } catch (error) {
        return serverError(res, 'assignment.getAll', error);
    }
};

const getByUuid = async (req, res) => {
    try {
        const row = await EmployeeComponentAssignment.query()
            .findOne({ uuid: req.params.uuid })
            .where('is_deleted', false)
            .withGraphFetched('[employee, component]');
        if (!row) return fail(res, 404, 'Component assignment not found.');
        return ok(res, row);
    } catch (error) {
        return serverError(res, 'assignment.getByUuid', error);
    }
};

const create = async (req, res) => {
    try {
        const err = validate(req.body);
        if (err) return fail(res, 400, err);

        const [employee, component] = await Promise.all([
            Employee.query().findById(req.body.employee_id).where('is_deleted', false),
            PayComponent.query().findById(req.body.component_id).where('is_deleted', false),
        ]);
        if (!employee) return fail(res, 404, 'Employee not found.');
        if (!component) return fail(res, 404, 'Pay component not found.');
        if (component.is_statutory) {
            return fail(res, 422, 'Statutory components are computed automatically and cannot be assigned manually.');
        }

        const dupe = await EmployeeComponentAssignment.query().findOne({
            employee_id: req.body.employee_id,
            component_id: req.body.component_id,
            start_date: req.body.start_date,
        });
        if (dupe) {
            return fail(res, 409, 'This employee already has an assignment for that component starting on that date.');
        }

        const outstanding = isValidNumber(req.body.outstanding_balance)
            ? Number(req.body.outstanding_balance)
            : (isValidNumber(req.body.principal_amount) ? Number(req.body.principal_amount) : null);

        const row = await EmployeeComponentAssignment.query()
            .insertAndFetch(definedOnly({
                employee_id: Number(req.body.employee_id),
                component_id: Number(req.body.component_id),
                amount: isValidNumber(req.body.amount) ? Number(req.body.amount) : null,
                rate: isValidNumber(req.body.rate) ? Number(req.body.rate) : null,
                principal_amount: isValidNumber(req.body.principal_amount) ? Number(req.body.principal_amount) : null,
                outstanding_balance: outstanding,
                installment_amount: isValidNumber(req.body.installment_amount) ? Number(req.body.installment_amount) : null,
                reference_no: trimOrNull(req.body.reference_no),
                start_date: req.body.start_date,
                end_date: trimOrNull(req.body.end_date),
                status: req.body.status || 'active',
                notes: trimOrNull(req.body.notes),
                metadata: req.body.metadata ?? null,
                created_by: actorId(req),
            }))
            .context(withActor(req));

        await logActivity({
            employeeId: row.employee_id,
            action: 'payroll.assignment_created',
            category: 'payroll',
            description: `Assigned "${component.name}" to employee #${row.employee_id}`,
            metadata: { assignment_uuid: row.uuid, component_code: component.code },
            req,
        });

        return created(res, row);
    } catch (error) {
        return serverError(res, 'assignment.create', error);
    }
};

const update = async (req, res) => {
    try {
        const row = await EmployeeComponentAssignment.query().findOne({ uuid: req.params.uuid }).where('is_deleted', false);
        if (!row) return fail(res, 404, 'Component assignment not found.');

        const err = validate({ ...req.body, employee_id: row.employee_id, component_id: row.component_id }, { partial: true });
        if (err) return fail(res, 400, err);

        const patch = definedOnly({
            amount: req.body.amount === undefined ? undefined : (isValidNumber(req.body.amount) ? Number(req.body.amount) : null),
            rate: req.body.rate === undefined ? undefined : (isValidNumber(req.body.rate) ? Number(req.body.rate) : null),
            principal_amount: req.body.principal_amount === undefined ? undefined : (isValidNumber(req.body.principal_amount) ? Number(req.body.principal_amount) : null),
            outstanding_balance: req.body.outstanding_balance === undefined ? undefined : (isValidNumber(req.body.outstanding_balance) ? Number(req.body.outstanding_balance) : null),
            installment_amount: req.body.installment_amount === undefined ? undefined : (isValidNumber(req.body.installment_amount) ? Number(req.body.installment_amount) : null),
            reference_no: req.body.reference_no === undefined ? undefined : trimOrNull(req.body.reference_no),
            start_date: req.body.start_date,
            end_date: req.body.end_date === undefined ? undefined : trimOrNull(req.body.end_date),
            status: req.body.status,
            notes: req.body.notes === undefined ? undefined : trimOrNull(req.body.notes),
            metadata: req.body.metadata,
            updated_by: actorId(req),
        });

        const updated = await EmployeeComponentAssignment.query()
            .patchAndFetchById(row.id, patch)
            .context(withActor(req));

        await logActivity({
            employeeId: updated.employee_id,
            action: 'payroll.assignment_updated',
            category: 'payroll',
            description: `Updated component assignment ${updated.uuid}`,
            metadata: { assignment_uuid: updated.uuid },
            req,
        });

        return ok(res, updated);
    } catch (error) {
        return serverError(res, 'assignment.update', error);
    }
};

const remove = async (req, res) => {
    try {
        const row = await EmployeeComponentAssignment.query().findOne({ uuid: req.params.uuid }).where('is_deleted', false);
        if (!row) return fail(res, 404, 'Component assignment not found.');

        await EmployeeComponentAssignment.query().patchAndFetchById(row.id, {
            is_deleted: true, status: 'cancelled', updated_by: actorId(req),
        }).context(withActor(req));

        await logActivity({
            employeeId: row.employee_id,
            action: 'payroll.assignment_archived',
            category: 'payroll',
            description: `Archived component assignment ${row.uuid}`,
            metadata: { assignment_uuid: row.uuid },
            req,
        });

        return ok(res, { uuid: row.uuid }, { message: 'Component assignment archived.' });
    } catch (error) {
        return serverError(res, 'assignment.remove', error);
    }
};

module.exports = { getAll, getByUuid, create, update, remove };
