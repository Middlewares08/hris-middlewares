// src/module/admin/services/govFilings/aggregate.js
//
// The single data layer every PH government filing artifact reads from
// (SSS R3, PhilHealth RF1, Pag-IBIG MCRF, BIR 2316, BIR 1604-C Alphalist).
//
// It rolls up `payroll.payslips` + `payslip_lines` for a period, joins the
// employee + decrypted government IDs, reconstructs the statutory bases
// (SSS MSC, PhilHealth premium base, Pag-IBIG comp) from the effective
// `payroll.statutory_tables`, and returns { period, rows, totals, warnings }.
//
// It does NOT format anything — that is the format writers' job (./formats/*).

const knex = require('../../../../database/connection');
const GovernmentDetail = require('../../../../database/models/employee/GovernmentDetail');
const StatutoryTable = require('../../../../database/models/payroll/StatutoryTable');
const EmployeeCompensation = require('../../../../database/models/payroll/EmployeeCompensation');
const { _internals } = require('../payrollCalculator');

const { capSalary } = _internals;

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// Runs whose payslips are "real enough" to file. Callers can widen/narrow.
const DEFAULT_STATUSES = ['calculated', 'approved', 'paid'];

const EE_ER_CODES = ['SSS_EE', 'SSS_ER', 'SSS_EC', 'PHIC_EE', 'PHIC_ER', 'HDMF_EE', 'HDMF_ER'];

const monthWindow = (year, month) => {
    const y = Number(year);
    const m = Number(month);
    const from = `${y}-${String(m).padStart(2, '0')}-01`;
    const to = `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    return { from, to };
};

const nameParts = (e) => ({
    lastName: (e.last_name || '').trim(),
    firstName: (e.first_name || '').trim(),
    middleName: (e.middle_name || '').trim(),
    fullName: `${e.first_name || ''} ${e.middle_name ? `${e.middle_name} ` : ''}${e.last_name || ''}`.replace(/\s+/g, ' ').trim(),
});

/**
 * Fetch payslips (with the run + period context) whose pay window intersects
 * [from, to], plus the summed statutory line amounts per payslip.
 */
async function fetchPayslips({ from, to, dateField = 'period', statuses = DEFAULT_STATUSES }) {
    const q = knex('payroll.payslips as ps')
        .join('payroll.payroll_runs as pr', 'pr.id', 'ps.payroll_run_id')
        .join('payroll.pay_periods as pp', 'pp.id', 'pr.pay_period_id')
        .where('ps.is_deleted', false)
        .andWhere('pr.is_deleted', false)
        .whereIn('pr.status', statuses)
        .select(
            'ps.id', 'ps.employee_id', 'ps.monthly_equivalent', 'ps.gross_pay',
            'ps.taxable_income', 'ps.non_taxable_income', 'ps.withholding_tax',
            'ps.basic_pay', 'ps.total_earnings',
            'pp.period_start', 'pp.period_end', 'pp.pay_date',
            'pr.run_type', 'pr.status as run_status',
        );

    if (dateField === 'pay_date') {
        q.whereBetween('pp.pay_date', [from, to]);
    } else {
        q.where('pp.period_start', '<=', to).andWhere('pp.period_end', '>=', from);
    }

    const payslips = await q;
    if (!payslips.length) return { payslips, linesByPayslip: new Map() };

    const ids = payslips.map((p) => p.id);
    const lineRows = await knex('payroll.payslip_lines')
        .whereIn('payslip_id', ids)
        .andWhere('is_deleted', false)
        .whereIn('code', [...EE_ER_CODES, 'WTAX', 'THIRTEENTH_MONTH'])
        .groupBy('payslip_id', 'code')
        .select('payslip_id', 'code')
        .sum({ amount: 'amount' });

    const linesByPayslip = new Map();
    for (const r of lineRows) {
        if (!linesByPayslip.has(r.payslip_id)) linesByPayslip.set(r.payslip_id, {});
        linesByPayslip.get(r.payslip_id)[r.code] = num(r.amount);
    }
    return { payslips, linesByPayslip };
}

/** Employee name rows + decrypted government IDs, keyed by employee id.
 *  `{ profile: true }` also loads birthdate / address / contact (for BIR 2316). */
async function fetchEmployeeMeta(employeeIds, { profile = false } = {}) {
    const ids = [...new Set(employeeIds.map(Number))];
    if (!ids.length) return new Map();

    const jobs = [
        knex('employee.employees')
            .whereIn('id', ids)
            .select('id', 'first_name', 'middle_name', 'last_name', 'employee_id as emp_no', 'is_active'),
        GovernmentDetail.query().whereIn('employee_id', ids),
    ];
    if (profile) {
        jobs.push(
            knex('employee.demographics').whereIn('employee_id', ids).select('employee_id', 'date_of_birth', 'gender'),
            knex('employee.contacts').whereIn('employee_id', ids).select('employee_id', 'personal_phone', 'personal_email'),
            knex('employee.addresses').whereIn('employee_id', ids)
                .select('employee_id', 'street_address', 'barangay', 'city', 'state_province', 'postal_code'),
        );
    }
    const [employees, govDetails, demographics = [], contacts = [], addresses = []] = await Promise.all(jobs);

    const govByEmp = new Map(govDetails.map((g) => [Number(g.employee_id), g]));
    const demoByEmp = new Map(demographics.map((d) => [Number(d.employee_id), d]));
    const contactByEmp = new Map(contacts.map((c) => [Number(c.employee_id), c]));
    const addrByEmp = new Map();
    for (const a of addresses) {
        const k = Number(a.employee_id);
        if (!addrByEmp.has(k)) addrByEmp.set(k, a);
    }

    const map = new Map();
    for (const e of employees) {
        const g = govByEmp.get(Number(e.id)) || {};
        const base = {
            employeeId: Number(e.id),
            employeeNo: e.emp_no || null,
            isActive: e.is_active !== false,
            ...nameParts(e),
            tin: g.tin_number || null,
            sssNo: g.sss_number || null,
            philhealthNo: g.philhealth_number || null,
            pagibigNo: g.pagibig_number || null,
            isSssExempt: !!g.is_sss_exempt,
            isPhilhealthExempt: !!g.is_philhealth_exempt,
            isPagibigExempt: !!g.is_pagibig_exempt,
        };
        if (profile) {
            const d = demoByEmp.get(Number(e.id)) || {};
            const c = contactByEmp.get(Number(e.id)) || {};
            const a = addrByEmp.get(Number(e.id)) || {};
            base.dateOfBirth = d.date_of_birth || null;
            base.gender = d.gender || null;
            base.phone = c.personal_phone || null;
            base.email = c.personal_email || null;
            base.address = [a.street_address, a.barangay, a.city, a.state_province, a.postal_code].filter(Boolean).join(', ') || null;
        }
        map.set(Number(e.id), base);
    }
    return map;
}

/* ============================================================
 * Monthly contributions — SSS R3 / PhilHealth RF1 / Pag-IBIG MCRF
 * ========================================================== */

/**
 * @param {number} year
 * @param {number} month   1-12
 * @param {{ statuses?: string[] }} [opts]
 * @returns {Promise<{ period, rows, totals, warnings }>}
 */
async function monthlyContributions(year, month, opts = {}) {
    const { from, to } = monthWindow(year, month);
    const statuses = opts.statuses || DEFAULT_STATUSES;

    const { payslips, linesByPayslip } = await fetchPayslips({ from, to, dateField: 'period', statuses });

    const [sssTable, phicTable, hdmfTable] = await Promise.all([
        StatutoryTable.resolve('sss', to),
        StatutoryTable.resolve('philhealth', to),
        StatutoryTable.resolve('pagibig', to),
    ]);

    // Aggregate the per-payslip line sums up to the employee for the month.
    const perEmp = new Map();
    for (const ps of payslips) {
        const eid = Number(ps.employee_id);
        if (!perEmp.has(eid)) {
            perEmp.set(eid, {
                monthlyComp: 0, payslipCount: 0, grossPay: 0,
                SSS_EE: 0, SSS_ER: 0, SSS_EC: 0, PHIC_EE: 0, PHIC_ER: 0, HDMF_EE: 0, HDMF_ER: 0,
            });
        }
        const acc = perEmp.get(eid);
        acc.payslipCount += 1;
        acc.grossPay += num(ps.gross_pay);
        acc.monthlyComp = Math.max(acc.monthlyComp, num(ps.monthly_equivalent));
        const lines = linesByPayslip.get(ps.id) || {};
        for (const code of EE_ER_CODES) acc[code] += num(lines[code] || 0);
    }

    const meta = await fetchEmployeeMeta([...perEmp.keys()]);
    const warnings = [];
    const rows = [];

    for (const [eid, acc] of perEmp) {
        const m = meta.get(eid) || { employeeId: eid, fullName: `Employee #${eid}` };
        const comp = acc.monthlyComp;

        const sssMsc = sssTable ? capSalary(comp, sssTable) : comp;
        const phicBase = phicTable ? capSalary(comp, phicTable) : comp;
        const hdmfBase = hdmfTable ? capSalary(comp, hdmfTable) : comp;

        const row = {
            ...m,
            monthlyComp: round2(comp),
            payslipCount: acc.payslipCount,
            sss: {
                msc: round2(sssMsc),
                ee: round2(acc.SSS_EE), er: round2(acc.SSS_ER), ec: round2(acc.SSS_EC),
                total: round2(acc.SSS_EE + acc.SSS_ER + acc.SSS_EC),
            },
            philhealth: {
                base: round2(phicBase),
                ee: round2(acc.PHIC_EE), er: round2(acc.PHIC_ER),
                total: round2(acc.PHIC_EE + acc.PHIC_ER),
            },
            pagibig: {
                base: round2(hdmfBase),
                ee: round2(acc.HDMF_EE), er: round2(acc.HDMF_ER),
                total: round2(acc.HDMF_EE + acc.HDMF_ER),
            },
        };
        rows.push(row);

        if ((row.sss.total > 0) && !m.sssNo) warnings.push({ employeeId: eid, name: m.fullName, issue: 'SSS contribution present but no SSS number on file.' });
        if ((row.philhealth.total > 0) && !m.philhealthNo) warnings.push({ employeeId: eid, name: m.fullName, issue: 'PhilHealth contribution present but no PhilHealth number on file.' });
        if ((row.pagibig.total > 0) && !m.pagibigNo) warnings.push({ employeeId: eid, name: m.fullName, issue: 'Pag-IBIG contribution present but no Pag-IBIG number on file.' });
        if (!m.tin) warnings.push({ employeeId: eid, name: m.fullName, issue: 'No TIN on file.' });
    }

    rows.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));

    const sum = (path) => round2(rows.reduce((t, r) => t + path.split('.').reduce((o, k) => o?.[k], r), 0));
    const totals = {
        employees: rows.length,
        sss: { ee: sum('sss.ee'), er: sum('sss.er'), ec: sum('sss.ec'), total: sum('sss.total') },
        philhealth: { ee: sum('philhealth.ee'), er: sum('philhealth.er'), total: sum('philhealth.total') },
        pagibig: { ee: sum('pagibig.ee'), er: sum('pagibig.er'), total: sum('pagibig.total') },
    };

    return {
        period: { year: Number(year), month: Number(month), from, to },
        statutoryTables: {
            sss: sssTable ? { label: sssTable.label, effective_from: sssTable.effective_from } : null,
            philhealth: phicTable ? { label: phicTable.label, effective_from: phicTable.effective_from } : null,
            pagibig: hdmfTable ? { label: hdmfTable.label, effective_from: hdmfTable.effective_from } : null,
        },
        rows,
        totals,
        warnings,
    };
}

/* ============================================================
 * Annual compensation — BIR 2316 / 1604-C Alphalist
 * ========================================================== */

/** Annual graduated tax due on `annualTaxable`, derived from the effective
 *  monthly withholding table (monthly bounds × 12). */
function annualTaxDue(annualTaxable, monthlyTable) {
    if (!monthlyTable || monthlyTable.computation_type !== 'tax_bracket') return 0;
    const brackets = (monthlyTable.brackets || []).slice().sort((a, b) => num(a.lower_bound) - num(b.lower_bound));
    if (!brackets.length || annualTaxable <= 0) return 0;

    const annual = brackets.map((b) => ({
        lower: num(b.lower_bound) * 12,
        upper: b.upper_bound == null ? Infinity : num(b.upper_bound) * 12,
        baseTax: num(b.base_tax) * 12,
        rate: num(b.tax_rate),
    }));
    const band = annual.find((b) => annualTaxable >= b.lower && annualTaxable <= b.upper) || annual[annual.length - 1];
    return Math.max(0, round2(band.baseTax + (annualTaxable - band.lower) * band.rate));
}

/**
 * @param {number} year
 * @param {{ statuses?: string[] }} [opts]
 * @returns {Promise<{ period, rows, totals, warnings }>}
 */
async function annualCompensation(year, opts = {}) {
    const y = Number(year);
    const from = `${y}-01-01`;
    const to = `${y}-12-31`;
    const statuses = opts.statuses || DEFAULT_STATUSES;

    const { payslips, linesByPayslip } = await fetchPayslips({ from, to, dateField: 'pay_date', statuses });
    const wtaxTable = await StatutoryTable.resolve('withholding_tax', to);

    const perEmp = new Map();
    for (const ps of payslips) {
        const eid = Number(ps.employee_id);
        if (!perEmp.has(eid)) {
            perEmp.set(eid, {
                gross: 0, taxable: 0, nonTaxable: 0, tax: 0, basic: 0,
                sssEE: 0, phicEE: 0, hdmfEE: 0, thirteenthMonth: 0,
                months: new Set(), payslipCount: 0, lastMonthlyEq: 0,
            });
        }
        const acc = perEmp.get(eid);
        const lines = linesByPayslip.get(ps.id) || {};
        acc.gross += num(ps.gross_pay);
        acc.taxable += num(ps.taxable_income);
        acc.nonTaxable += num(ps.non_taxable_income);
        acc.tax += num(ps.withholding_tax);
        acc.basic += num(ps.basic_pay);
        acc.sssEE += num(lines.SSS_EE || 0);
        acc.phicEE += num(lines.PHIC_EE || 0);
        acc.hdmfEE += num(lines.HDMF_EE || 0);
        acc.thirteenthMonth += num(lines.THIRTEENTH_MONTH || 0);
        acc.payslipCount += 1;
        acc.lastMonthlyEq = num(ps.monthly_equivalent);
        acc.months.add(String(ps.pay_date).slice(0, 7));
    }

    // MWE flag + latest tax status from the employee's most recent compensation in the year.
    const empIds = [...perEmp.keys()];
    const [meta, comps, separations] = await Promise.all([
        fetchEmployeeMeta(empIds, { profile: opts.includeProfile !== false }),
        empIds.length
            ? EmployeeCompensation.query()
                .whereIn('employee_id', empIds)
                .where('is_deleted', false)
                .orderBy('effective_date', 'desc')
            : [],
        empIds.length
            ? knex('employee.separations')
                .whereIn('employee_id', empIds)
                .where('is_deleted', false)
                .whereBetween('separation_date', [from, to])
                .select('employee_id', 'separation_date', 'separation_type')
            : [],
    ]);

    const compByEmp = new Map();
    for (const c of comps) if (!compByEmp.has(Number(c.employee_id))) compByEmp.set(Number(c.employee_id), c);
    const sepByEmp = new Map(separations.map((s) => [Number(s.employee_id), s]));

    const warnings = [];
    const rows = [];

    for (const [eid, acc] of perEmp) {
        const m = meta.get(eid) || { employeeId: eid, fullName: `Employee #${eid}` };
        const comp = compByEmp.get(eid);
        const sep = sepByEmp.get(eid);

        const mandatoryEE = round2(acc.sssEE + acc.phicEE + acc.hdmfEE);
        const taxable = round2(acc.taxable);
        const taxDue = annualTaxDue(taxable, wtaxTable);
        const taxWithheld = round2(acc.tax);

        const row = {
            ...m,
            isMWE: !!(comp && comp.is_minimum_wage_earner),
            isTaxExempt: !!(comp && comp.is_tax_exempt),
            taxStatus: comp?.tax_status || null,
            monthsWorked: acc.months.size,
            payslipCount: acc.payslipCount,
            terminated: !!sep,
            separationDate: sep?.separation_date || null,
            separationType: sep?.separation_type || null,

            grossCompensation: round2(acc.gross),
            basicSalary: round2(acc.basic),
            thirteenthMonthAndOther: round2(acc.thirteenthMonth),
            nonTaxableCompensation: round2(acc.nonTaxable + mandatoryEE),
            mandatoryContributionsEE: mandatoryEE,
            sssEE: round2(acc.sssEE),
            philhealthEE: round2(acc.phicEE),
            pagibigEE: round2(acc.hdmfEE),
            taxableCompensation: taxable,
            taxDue,
            taxWithheld,
            taxAdjustment: round2(taxDue - taxWithheld),
        };
        rows.push(row);

        if (!m.tin) warnings.push({ employeeId: eid, name: m.fullName, issue: 'No TIN on file — required for BIR 2316 / Alphalist.' });
        if (acc.months.size < 12 && !sep) warnings.push({ employeeId: eid, name: m.fullName, issue: `Only ${acc.months.size} month(s) of payroll found — verify prior-employer compensation isn't missing.` });
        if (Math.abs(row.taxAdjustment) >= 1) warnings.push({ employeeId: eid, name: m.fullName, issue: `Tax withheld (${taxWithheld}) differs from annual tax due (${taxDue}) by ${row.taxAdjustment} — year-end adjustment needed.` });
    }

    rows.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));

    const sum = (k) => round2(rows.reduce((t, r) => t + num(r[k]), 0));
    const totals = {
        employees: rows.length,
        grossCompensation: sum('grossCompensation'),
        nonTaxableCompensation: sum('nonTaxableCompensation'),
        taxableCompensation: sum('taxableCompensation'),
        taxDue: sum('taxDue'),
        taxWithheld: sum('taxWithheld'),
        mwe: rows.filter((r) => r.isMWE).length,
        terminated: rows.filter((r) => r.terminated).length,
    };

    return {
        period: { year: y, from, to },
        withholdingTable: wtaxTable ? { label: wtaxTable.label, effective_from: wtaxTable.effective_from } : null,
        rows,
        totals,
        warnings,
    };
}

module.exports = { monthlyContributions, annualCompensation, annualTaxDue, DEFAULT_STATUSES };
