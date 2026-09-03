// src/module/admin/services/govFilings/formats/philhealthRF1.js
//
// PhilHealth Employer Remittance Report (RF-1) — EPRS member-list upload.
//
// EPRS accepts a headerless CSV of member premium lines. Column order
// implemented (VERIFY against your EPRS account's current template):
//
//   PhilHealthNo, LastName, FirstName, MiddleName, ExtName,
//   MonthlyCompensation, PersonalShare, EmployerShare, Total
//
// `format: 'csv'` = the EPRS load file (no header).
// `format: 'csv-labelled'` = same rows with a header, for human review.

const W = require('./writers');

const filenameBase = ({ period, profile }) => {
    const pen = W.digits(profile?.philhealth_pen) || 'PEN';
    return `PhilHealth-RF1_${pen}_${period.year}${String(period.month).padStart(2, '0')}`;
};

const line = (r) => [
    W.philId(r.philhealthNo),
    W.upper(r.lastName),
    W.upper(r.firstName),
    W.upper(r.middleName),
    '', // extension name — not modelled
    W.money(r.philhealth.base),
    W.money(r.philhealth.ee),
    W.money(r.philhealth.er),
    W.money(r.philhealth.total),
];

const HEADER = ['PhilHealth No', 'Last Name', 'First Name', 'Middle Name', 'Ext Name',
    'Monthly Compensation', 'Personal Share', 'Employer Share', 'Total'];

function generate(agg, ctx, format = 'csv') {
    const base = filenameBase({ period: agg.period, profile: ctx.profile });
    const rows = agg.rows.map(line);

    const withHeader = format === 'csv-labelled';
    const body = W.file([
        ...(withHeader ? [W.row(HEADER)] : []),
        ...rows.map((cells) => W.row(cells)),
        // EPRS totals aren't part of the load file; keep them out of plain 'csv'.
        ...(withHeader ? [W.row(['', '', '', '', 'TOTAL',
            '', W.money(agg.totals.philhealth.ee), W.money(agg.totals.philhealth.er), W.money(agg.totals.philhealth.total)])] : []),
    ]);

    return {
        filename: `${base}${withHeader ? '_review' : ''}.csv`,
        contentType: 'text/csv;charset=utf-8',
        body,
    };
}

module.exports = { generate, formats: ['csv', 'csv-labelled'] };
