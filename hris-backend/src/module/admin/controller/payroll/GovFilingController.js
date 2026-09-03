// src/module/admin/controller/payroll/GovFilingController.js
//
// Government filing artifacts — BIR 2316 / 1604-C Alphalist, SSS R3,
// PhilHealth RF1, Pag-IBIG MCRF.
//
//   GET /payroll/gov-forms                      -> catalogue
//   GET /payroll/gov-forms/preview?form&year&month  -> aggregated rows + totals + warnings
//   GET /payroll/gov-forms/download?form&year&month&format[&employee_id]  -> the artifact

const { monthlyContributions, annualCompensation } = require('../../services/govFilings/aggregate');
const { REGISTRY, generate } = require('../../services/govFilings/formats');
const EmployerProfile = require('../../../../database/models/payroll/EmployerProfile');
const { completeness } = require('./EmployerProfileController');
const { fail, ok, serverError } = require('./_helpers');

const FORMS = {
    'sss-r3': { agency: 'SSS', title: 'SSS Contribution Collection List (R3)', period: 'month' },
    'philhealth-rf1': { agency: 'PhilHealth', title: 'PhilHealth Employer Remittance Report (RF-1)', period: 'month' },
    'pagibig-mcrf': { agency: 'Pag-IBIG', title: 'Pag-IBIG Membership Contribution Remittance Form (MCRF)', period: 'month' },
    'bir-2316': { agency: 'BIR', title: 'Certificate of Compensation Payment / Tax Withheld (2316)', period: 'year' },
    'bir-alphalist': { agency: 'BIR', title: 'Alphabetical List of Employees (1604-C)', period: 'year' },
};

const catalogue = () => Object.entries(FORMS).map(([key, f]) => ({
    key,
    ...f,
    source: REGISTRY[key].source,
    formats: REGISTRY[key].formats,
    defaultFormat: REGISTRY[key].defaultFormat,
}));

const listForms = (_req, res) => ok(res, catalogue());

const parseCommon = (req) => {
    const key = String(req.query.form || '');
    const entry = REGISTRY[key];
    if (!entry) return { error: `Unknown form. Expected one of: ${Object.keys(FORMS).join(', ')}` };

    const year = Number(req.query.year) || new Date().getFullYear();
    if (year < 2000 || year > 2100) return { error: 'year is out of range.' };

    const statuses = req.query.statuses
        ? String(req.query.statuses).split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;

    let month = null;
    if (entry.source === 'monthly') {
        month = Number(req.query.month);
        if (!(month >= 1 && month <= 12)) return { error: 'month (1-12) is required for this form.' };
    }
    return { key, entry, year, month, statuses };
};

const aggregateFor = (entry, { year, month, statuses }) =>
    entry.source === 'monthly'
        ? monthlyContributions(year, month, { statuses })
        : annualCompensation(year, { statuses });

const preview = async (req, res) => {
    try {
        const c = parseCommon(req);
        if (c.error) return fail(res, 400, c.error);

        const profileRow = await EmployerProfile.singleton();
        const profile = typeof profileRow.toJSON === 'function' ? profileRow.toJSON() : profileRow;
        const profileCheck = completeness(profile);

        const data = await aggregateFor(c.entry, c);

        return ok(res, {
            form: { key: c.key, ...FORMS[c.key], formats: c.entry.formats, defaultFormat: c.entry.defaultFormat },
            employerProfileComplete: profileCheck.isComplete,
            employerProfileMissing: profileCheck.missing,
            ...data,
        });
    } catch (error) {
        return serverError(res, 'govFilings.preview', error);
    }
};

const download = async (req, res) => {
    try {
        const c = parseCommon(req);
        if (c.error) return fail(res, 400, c.error);

        const format = req.query.format ? String(req.query.format) : undefined;
        const employeeId = req.query.employee_id ? Number(req.query.employee_id) : undefined;

        const profileRow = await EmployerProfile.singleton();
        const profile = typeof profileRow.toJSON === 'function' ? profileRow.toJSON() : profileRow;
        if (!completeness(profile).isComplete) {
            return fail(res, 422, 'Employer profile is incomplete — fill it in before generating filing artifacts.');
        }

        const data = await aggregateFor(c.entry, c);
        if (!data.rows.length) return fail(res, 404, 'No payroll data found for this period.');

        const artifact = await generate(c.key, data, { profile }, format, employeeId ? { employeeId } : {});

        res.setHeader('Content-Type', artifact.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${artifact.filename}"`);
        const buf = Buffer.isBuffer(artifact.body) ? artifact.body : Buffer.from(artifact.body, 'utf-8');
        res.setHeader('Content-Length', buf.length);
        return res.send(buf);
    } catch (error) {
        return serverError(res, 'govFilings.download', error);
    }
};

module.exports = { listForms, preview, download, FORMS };
