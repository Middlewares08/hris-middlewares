// src/module/admin/controller/payroll/PayComponentController.js
const PayComponent = require('../../../../database/models/payroll/PayComponent');
const EmployeeComponentAssignment = require('../../../../database/models/payroll/EmployeeComponentAssignment');
const { logActivity } = require('../../../../utils/activityLogger');
const {
    actorId, withActor, ok, created, fail, serverError,
    parsePagination, paginationMeta, toBool, trimOrNull, definedOnly,
} = require('./_helpers');

const { COMPONENT_TYPES, CALCULATION_TYPES } = PayComponent;

const validate = (body, { partial = false } = {}) => {
    const { code, name, component_type, calculation_type, default_amount, default_rate } = body;

    if (!partial || code !== undefined) {
        if (!trimOrNull(code)) return 'code is required.';
        if (!/^[A-Za-z0-9_]{2,60}$/.test(String(code).trim())) {
            return 'code must be 2–60 chars, letters / numbers / underscore only.';
        }
    }
    if (!partial || name !== undefined) {
        if (!trimOrNull(name)) return 'name is required.';
    }
    if (!partial || component_type !== undefined) {
        if (!COMPONENT_TYPES.includes(component_type)) {
            return `component_type must be one of: ${COMPONENT_TYPES.join(', ')}`;
        }
    }
    if (calculation_type !== undefined && !CALCULATION_TYPES.includes(calculation_type)) {
        return `calculation_type must be one of: ${CALCULATION_TYPES.join(', ')}`;
    }
    if (default_amount !== undefined && default_amount !== null && !Number.isFinite(Number(default_amount))) {
        return 'default_amount must be numeric.';
    }
    if (default_rate !== undefined && default_rate !== null && !Number.isFinite(Number(default_rate))) {
        return 'default_rate must be numeric.';
    }
    return null;
};

const getAll = async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { search, component_type, calculation_type, is_active } = req.query;

        let query = PayComponent.query().where('is_deleted', false);
        if (component_type) query = query.where('component_type', component_type);
        if (calculation_type) query = query.where('calculation_type', calculation_type);
        if (is_active !== undefined) query = query.where('is_active', toBool(is_active));
        if (search) {
            query = query.where((b) => {
                b.where('code', 'ilike', `%${search}%`).orWhere('name', 'ilike', `%${search}%`);
            });
        }

        const result = await query
            .orderBy('display_order', 'asc')
            .orderBy('code', 'asc')
            .range(offset, offset + limit - 1);

        return ok(res, result.results, { pagination: paginationMeta(result.total, page, limit) });
    } catch (error) {
        return serverError(res, 'component.getAll', error);
    }
};

const getByUuid = async (req, res) => {
    try {
        const component = await PayComponent.query()
            .findOne({ uuid: req.params.uuid })
            .where('is_deleted', false)
            .withGraphFetched('assignments(activeOnly)')
            .modifiers({ activeOnly: (b) => b.where('payroll.employee_component_assignments.is_deleted', false) });

        if (!component) return fail(res, 404, 'Pay component not found.');
        return ok(res, component);
    } catch (error) {
        return serverError(res, 'component.getByUuid', error);
    }
};

const create = async (req, res) => {
    try {
        const err = validate(req.body);
        if (err) return fail(res, 400, err);

        const code = String(req.body.code).trim().toUpperCase();
        const dupe = await PayComponent.query().findOne({ code });
        if (dupe) {
            return fail(res, 409, `A pay component with code "${code}" already exists${dupe.is_deleted ? ' (archived).' : '.'}`);
        }

        const component = await PayComponent.query()
            .insertAndFetch(definedOnly({
                code,
                name: String(req.body.name).trim(),
                description: trimOrNull(req.body.description),
                component_type: req.body.component_type,
                calculation_type: req.body.calculation_type || 'manual',
                default_amount: req.body.default_amount ?? null,
                default_rate: req.body.default_rate ?? null,
                is_taxable: toBool(req.body.is_taxable),
                is_statutory: toBool(req.body.is_statutory),
                affects_thirteenth_month: toBool(req.body.affects_thirteenth_month),
                is_active: req.body.is_active === undefined ? true : toBool(req.body.is_active),
                display_order: Number.isFinite(Number(req.body.display_order)) ? Number(req.body.display_order) : 0,
                gl_account: trimOrNull(req.body.gl_account),
                metadata: req.body.metadata ?? null,
                is_system: false,
                created_by: actorId(req),
            }))
            .context(withActor(req));

        await logActivity({
            employeeId: actorId(req),
            action: 'payroll.component_created',
            category: 'payroll',
            description: `Created pay component "${component.name}" (${component.code})`,
            metadata: { component_uuid: component.uuid, component_type: component.component_type },
            req,
        });

        return created(res, component);
    } catch (error) {
        return serverError(res, 'component.create', error);
    }
};

const update = async (req, res) => {
    try {
        const component = await PayComponent.query().findOne({ uuid: req.params.uuid }).where('is_deleted', false);
        if (!component) return fail(res, 404, 'Pay component not found.');

        const err = validate(req.body, { partial: true });
        if (err) return fail(res, 400, err);

        // System components: only presentation / behaviour flags may change, never identity.
        if (component.is_system && (req.body.code !== undefined || req.body.component_type !== undefined)) {
            return fail(res, 403, 'A system pay component\'s code and type are locked.');
        }

        if (req.body.code !== undefined) {
            const nextCode = String(req.body.code).trim().toUpperCase();
            if (nextCode !== component.code) {
                const dupe = await PayComponent.query().findOne({ code: nextCode }).whereNot('id', component.id);
                if (dupe) return fail(res, 409, `Another pay component already uses code "${nextCode}".`);
            }
        }

        const patch = definedOnly({
            code: req.body.code === undefined ? undefined : String(req.body.code).trim().toUpperCase(),
            name: req.body.name === undefined ? undefined : String(req.body.name).trim(),
            description: req.body.description === undefined ? undefined : trimOrNull(req.body.description),
            component_type: req.body.component_type,
            calculation_type: req.body.calculation_type,
            default_amount: req.body.default_amount,
            default_rate: req.body.default_rate,
            is_taxable: req.body.is_taxable === undefined ? undefined : toBool(req.body.is_taxable),
            is_statutory: req.body.is_statutory === undefined ? undefined : toBool(req.body.is_statutory),
            affects_thirteenth_month: req.body.affects_thirteenth_month === undefined ? undefined : toBool(req.body.affects_thirteenth_month),
            is_active: req.body.is_active === undefined ? undefined : toBool(req.body.is_active),
            display_order: req.body.display_order === undefined ? undefined : Number(req.body.display_order) || 0,
            gl_account: req.body.gl_account === undefined ? undefined : trimOrNull(req.body.gl_account),
            metadata: req.body.metadata,
            updated_by: actorId(req),
        });

        const updated = await PayComponent.query()
            .patchAndFetchById(component.id, patch)
            .context(withActor(req));

        await logActivity({
            employeeId: actorId(req),
            action: 'payroll.component_updated',
            category: 'payroll',
            description: `Updated pay component "${updated.name}" (${updated.code})`,
            metadata: { component_uuid: updated.uuid },
            req,
        });

        return ok(res, updated);
    } catch (error) {
        return serverError(res, 'component.update', error);
    }
};

const remove = async (req, res) => {
    try {
        const component = await PayComponent.query().findOne({ uuid: req.params.uuid }).where('is_deleted', false);
        if (!component) return fail(res, 404, 'Pay component not found.');
        if (component.is_system) return fail(res, 403, 'System pay components cannot be deleted. Set is_active = false instead.');

        const inUse = await EmployeeComponentAssignment.query()
            .where({ component_id: component.id, is_deleted: false })
            .resultSize();
        if (inUse > 0) {
            return fail(res, 409, `This component is assigned to ${inUse} employee(s). Remove those assignments first.`);
        }

        // Soft delete only — payslip_lines keep a component_id reference for history.
        await PayComponent.query().patchAndFetchById(component.id, {
            is_deleted: true, is_active: false, updated_by: actorId(req),
        }).context(withActor(req));

        await logActivity({
            employeeId: actorId(req),
            action: 'payroll.component_archived',
            category: 'payroll',
            description: `Archived pay component "${component.name}" (${component.code})`,
            metadata: { component_uuid: component.uuid },
            req,
        });

        return ok(res, { uuid: component.uuid }, { message: 'Pay component archived.' });
    } catch (error) {
        return serverError(res, 'component.remove', error);
    }
};

module.exports = { getAll, getByUuid, create, update, remove };
