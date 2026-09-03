// src/module/admin/controller/payroll/EmployerProfileController.js
const EmployerProfile = require('../../../../database/models/payroll/EmployerProfile');
const { logActivity } = require('../../../../utils/activityLogger');
const { actorId, withActor, ok, fail, serverError, trimOrNull, definedOnly } = require('./_helpers');

// Fields the client may write. `id` / audit columns are never accepted.
const WRITABLE = [
    'legal_name', 'trade_name', 'tin', 'tin_branch', 'rdo_code', 'business_category',
    'address_line1', 'address_line2', 'city', 'province', 'zip_code',
    'sss_employer_no', 'philhealth_pen', 'pagibig_employer_id',
    'signatory_name', 'signatory_position', 'signatory_tin',
    'contact_person', 'contact_email', 'contact_phone',
];

const digits = (v) => String(v ?? '').replace(/\D/g, '');

const validate = (body) => {
    if (body.tin !== undefined && body.tin !== null && body.tin !== '' && digits(body.tin).length !== 9) {
        return 'TIN must be 9 digits (branch code is separate).';
    }
    if (body.tin_branch !== undefined && body.tin_branch && digits(body.tin_branch).length > 5) {
        return 'TIN branch code must be at most 5 digits.';
    }
    if (body.signatory_tin !== undefined && body.signatory_tin && ![9, 12].includes(digits(body.signatory_tin).length)) {
        return "Signatory TIN must be 9 or 12 digits.";
    }
    if (body.business_category !== undefined && !EmployerProfile.CATEGORIES.includes(body.business_category)) {
        return `business_category must be one of: ${EmployerProfile.CATEGORIES.join(', ')}`;
    }
    if (body.contact_email !== undefined && body.contact_email && !/^\S+@\S+\.\S+$/.test(body.contact_email)) {
        return 'contact_email is not a valid email address.';
    }
    return null;
};

/** Fields that must be set before any government artifact can be generated. */
const completeness = (row) => {
    const missing = [];
    if (!row.legal_name) missing.push('legal_name');
    if (digits(row.tin).length !== 9) missing.push('tin');
    if (!row.rdo_code) missing.push('rdo_code');
    if (!row.address_line1 || !row.city) missing.push('address');
    if (!row.sss_employer_no) missing.push('sss_employer_no');
    if (!row.philhealth_pen) missing.push('philhealth_pen');
    if (!row.pagibig_employer_id) missing.push('pagibig_employer_id');
    if (!row.signatory_name || !row.signatory_position) missing.push('signatory');
    return { isComplete: missing.length === 0, missing };
};

const present = (row) => {
    const json = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
    return { ...json, _completeness: completeness(json) };
};

const get = async (_req, res) => {
    try {
        const row = await EmployerProfile.singleton();
        return ok(res, present(row));
    } catch (error) {
        return serverError(res, 'employerProfile.get', error);
    }
};

const update = async (req, res) => {
    try {
        const err = validate(req.body || {});
        if (err) return fail(res, 400, err);

        const patch = definedOnly(
            Object.fromEntries(WRITABLE.map((k) => [k, req.body[k] === undefined ? undefined : trimOrNull(req.body[k])])),
        );
        if (req.body.tin !== undefined) patch.tin = req.body.tin ? digits(req.body.tin) : null;
        if (req.body.tin_branch !== undefined) patch.tin_branch = req.body.tin_branch ? digits(req.body.tin_branch).padStart(4, '0') : '0000';
        if (req.body.signatory_tin !== undefined) patch.signatory_tin = req.body.signatory_tin ? digits(req.body.signatory_tin) : null;

        await EmployerProfile.singleton();
        const row = await EmployerProfile.query()
            .context(withActor(req))
            .patchAndFetchById(EmployerProfile.ROW_ID, { ...patch, updated_by: actorId(req) });

        await logActivity({
            employeeId: actorId(req),
            action: 'employer_profile.updated',
            category: 'payroll',
            description: 'Employer profile updated',
            metadata: { fields: Object.keys(patch) },
            req,
        });

        return ok(res, present(row));
    } catch (error) {
        return serverError(res, 'employerProfile.update', error);
    }
};

module.exports = { get, update, completeness };
