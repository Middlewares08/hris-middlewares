// src/module/admin/controller/payroll/EwtPayeeController.js
const EwtPayee = require('../../../../database/models/payroll/EwtPayee');
const { logActivity } = require('../../../../utils/activityLogger');
const {
    actorId, withActor, ok, created, fail, serverError,
    parsePagination, paginationMeta, toBool, trimOrNull, definedOnly,
} = require('./_helpers');

const { PAYEE_TYPES } = EwtPayee;

const digits = (v) => String(v ?? '').replace(/\D/g, '');

const validate = (body, { partial = false } = {}) => {
    const { payee_type, registered_name, tin, tin_branch } = body;

    if (!partial || payee_type !== undefined) {
        if (!PAYEE_TYPES.includes(payee_type)) return `payee_type must be one of: ${PAYEE_TYPES.join(', ')}`;
    }
    if (!partial || registered_name !== undefined) {
        if (!trimOrNull(registered_name)) return 'registered_name is required.';
    }
    if (!partial || tin !== undefined) {
        if (digits(tin).length !== 9) return 'tin must be 9 digits.';
    }
    if (tin_branch !== undefined && tin_branch !== null && tin_branch !== '' && digits(tin_branch).length > 5) {
        return 'tin_branch must be at most 5 digits.';
    }
    return null;
};

const getAll = async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { search, payee_type, is_active } = req.query;

        let query = EwtPayee.query().where('is_deleted', false);
        if (payee_type) query = query.where('payee_type', payee_type);
        if (is_active !== undefined) query = query.where('is_active', toBool(is_active));
        if (search) {
            query = query.where((b) => {
                b.where('registered_name', 'ilike', `%${search}%`)
                    .orWhere('trade_name', 'ilike', `%${search}%`)
                    .orWhere('tin', 'ilike', `%${search}%`);
            });
        }

        const result = await query
            .orderBy('registered_name', 'asc')
            .range(offset, offset + limit - 1);

        return ok(res, result.results, { pagination: paginationMeta(result.total, page, limit) });
    } catch (error) {
        return serverError(res, 'ewtPayee.getAll', error);
    }
};

const getByUuid = async (req, res) => {
    try {
        const payee = await EwtPayee.query().findOne({ uuid: req.params.uuid }).where('is_deleted', false);
        if (!payee) return fail(res, 404, 'Payee not found.');
        return ok(res, payee);
    } catch (error) {
        return serverError(res, 'ewtPayee.getByUuid', error);
    }
};

const create = async (req, res) => {
    try {
        const err = validate(req.body);
        if (err) return fail(res, 400, err);

        const tin = digits(req.body.tin);
        const tinBranch = digits(req.body.tin_branch) || '0000';
        const dupe = await EwtPayee.query().findOne({ tin, tin_branch: tinBranch }).where('is_deleted', false);
        if (dupe) return fail(res, 409, `A payee with TIN ${tin}-${tinBranch} already exists.`);

        const payee = await EwtPayee.query()
            .insertAndFetch(definedOnly({
                payee_type: req.body.payee_type,
                registered_name: String(req.body.registered_name).trim(),
                first_name: trimOrNull(req.body.first_name),
                middle_name: trimOrNull(req.body.middle_name),
                last_name: trimOrNull(req.body.last_name),
                trade_name: trimOrNull(req.body.trade_name),
                tin,
                tin_branch: tinBranch,
                address_line1: trimOrNull(req.body.address_line1),
                address_line2: trimOrNull(req.body.address_line2),
                city: trimOrNull(req.body.city),
                province: trimOrNull(req.body.province),
                zip_code: trimOrNull(req.body.zip_code),
                default_atc_code: trimOrNull(req.body.default_atc_code),
                contact_person: trimOrNull(req.body.contact_person),
                contact_email: trimOrNull(req.body.contact_email),
                contact_phone: trimOrNull(req.body.contact_phone),
                is_active: req.body.is_active === undefined ? true : toBool(req.body.is_active),
                remarks: trimOrNull(req.body.remarks),
                created_by: actorId(req),
            }))
            .context(withActor(req));

        await logActivity({
            employeeId: actorId(req),
            action: 'payroll.ewt_payee_created',
            category: 'payroll',
            description: `Created EWT payee "${payee.registered_name}"`,
            metadata: { payee_uuid: payee.uuid },
            req,
        });

        return created(res, payee);
    } catch (error) {
        return serverError(res, 'ewtPayee.create', error);
    }
};

const update = async (req, res) => {
    try {
        const payee = await EwtPayee.query().findOne({ uuid: req.params.uuid }).where('is_deleted', false);
        if (!payee) return fail(res, 404, 'Payee not found.');

        const err = validate(req.body, { partial: true });
        if (err) return fail(res, 400, err);

        if (req.body.tin !== undefined) {
            const nextTin = digits(req.body.tin);
            const nextBranch = req.body.tin_branch !== undefined ? (digits(req.body.tin_branch) || '0000') : payee.tin_branch;
            if (nextTin !== payee.tin || nextBranch !== payee.tin_branch) {
                const dupe = await EwtPayee.query().findOne({ tin: nextTin, tin_branch: nextBranch }).where('is_deleted', false).whereNot('id', payee.id);
                if (dupe) return fail(res, 409, `Another payee already uses TIN ${nextTin}-${nextBranch}.`);
            }
        }

        const patch = definedOnly({
            payee_type: req.body.payee_type,
            registered_name: req.body.registered_name === undefined ? undefined : String(req.body.registered_name).trim(),
            first_name: req.body.first_name === undefined ? undefined : trimOrNull(req.body.first_name),
            middle_name: req.body.middle_name === undefined ? undefined : trimOrNull(req.body.middle_name),
            last_name: req.body.last_name === undefined ? undefined : trimOrNull(req.body.last_name),
            trade_name: req.body.trade_name === undefined ? undefined : trimOrNull(req.body.trade_name),
            tin: req.body.tin === undefined ? undefined : digits(req.body.tin),
            tin_branch: req.body.tin_branch === undefined ? undefined : (digits(req.body.tin_branch) || '0000'),
            address_line1: req.body.address_line1 === undefined ? undefined : trimOrNull(req.body.address_line1),
            address_line2: req.body.address_line2 === undefined ? undefined : trimOrNull(req.body.address_line2),
            city: req.body.city === undefined ? undefined : trimOrNull(req.body.city),
            province: req.body.province === undefined ? undefined : trimOrNull(req.body.province),
            zip_code: req.body.zip_code === undefined ? undefined : trimOrNull(req.body.zip_code),
            default_atc_code: req.body.default_atc_code === undefined ? undefined : trimOrNull(req.body.default_atc_code),
            contact_person: req.body.contact_person === undefined ? undefined : trimOrNull(req.body.contact_person),
            contact_email: req.body.contact_email === undefined ? undefined : trimOrNull(req.body.contact_email),
            contact_phone: req.body.contact_phone === undefined ? undefined : trimOrNull(req.body.contact_phone),
            is_active: req.body.is_active === undefined ? undefined : toBool(req.body.is_active),
            remarks: req.body.remarks === undefined ? undefined : trimOrNull(req.body.remarks),
            updated_by: actorId(req),
        });

        const updated = await EwtPayee.query()
            .patchAndFetchById(payee.id, patch)
            .context(withActor(req));

        await logActivity({
            employeeId: actorId(req),
            action: 'payroll.ewt_payee_updated',
            category: 'payroll',
            description: `Updated EWT payee "${updated.registered_name}"`,
            metadata: { payee_uuid: updated.uuid },
            req,
        });

        return ok(res, updated);
    } catch (error) {
        return serverError(res, 'ewtPayee.update', error);
    }
};

const remove = async (req, res) => {
    try {
        const payee = await EwtPayee.query().findOne({ uuid: req.params.uuid }).where('is_deleted', false);
        if (!payee) return fail(res, 404, 'Payee not found.');

        // Soft delete only — ewt_payments.payee_id is RESTRICT, so payment history is never orphaned.
        await EwtPayee.query().patchAndFetchById(payee.id, {
            is_deleted: true, is_active: false, updated_by: actorId(req),
        }).context(withActor(req));

        await logActivity({
            employeeId: actorId(req),
            action: 'payroll.ewt_payee_archived',
            category: 'payroll',
            description: `Archived EWT payee "${payee.registered_name}"`,
            metadata: { payee_uuid: payee.uuid },
            req,
        });

        return ok(res, { uuid: payee.uuid }, { message: 'Payee archived.' });
    } catch (error) {
        return serverError(res, 'ewtPayee.remove', error);
    }
};

module.exports = { getAll, getByUuid, create, update, remove };
