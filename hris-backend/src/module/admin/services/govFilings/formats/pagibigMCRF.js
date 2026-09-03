// src/module/admin/services/govFilings/formats/pagibigMCRF.js
//
// Pag-IBIG Membership Contribution Remittance Form (MCRF) — electronic
// remittance schedule (Virtual Pag-IBIG / eSRS upload).
//
// Layout implemented (comma-delimited, CRLF). VERIFY against your Virtual
// Pag-IBIG employer account's current MCRF template before filing:
//
//   Header:  H,<Employer ID>,<Applicable Period MM/YYYY>,<Members>,<Total EE>,<Total ER>,<Total>
//   Detail:  D,<Pag-IBIG MID>,<Last>,<First>,<Middle>,<TIN>,<Monthly Comp>,<EE>,<ER>,<Total>
//   Trailer: T,<Members>,<Grand Total>

const W = require('./writers');

const filenameBase = ({ period, profile }) => {
    const er = W.digits(profile?.pagibig_employer_id) || 'ER';
    return `PagIBIG-MCRF_${er}_${period.year}${String(period.month).padStart(2, '0')}`;
};

function buildText({ rows, totals, period, profile }) {
    const lines = [];
    lines.push(W.row([
        'H',
        profile?.pagibig_employer_id || '',
        W.monthYear(period.year, period.month),
        rows.length,
        W.money(totals.pagibig.ee),
        W.money(totals.pagibig.er),
        W.money(totals.pagibig.total),
    ]));

    for (const r of rows) {
        lines.push(W.row([
            'D',
            W.pagibigId(r.pagibigNo),
            W.upper(r.lastName),
            W.upper(r.firstName),
            W.upper(r.middleName),
            W.digits(r.tin),
            W.money(r.pagibig.base),
            W.money(r.pagibig.ee),
            W.money(r.pagibig.er),
            W.money(r.pagibig.total),
        ]));
    }

    lines.push(W.row(['T', rows.length, W.money(totals.pagibig.total)]));
    return W.file(lines);
}

const CSV_COLUMNS = [
    { label: 'Pag-IBIG MID No', map: (r) => W.pagibigId(r.pagibigNo) },
    { label: 'Last Name', map: (r) => W.upper(r.lastName) },
    { label: 'First Name', map: (r) => W.upper(r.firstName) },
    { label: 'Middle Name', map: (r) => W.upper(r.middleName) },
    { label: 'TIN', map: (r) => W.digits(r.tin) },
    { label: 'Monthly Compensation', map: (r) => W.money(r.pagibig.base) },
    { label: 'Employee Share', map: (r) => W.money(r.pagibig.ee) },
    { label: 'Employer Share', map: (r) => W.money(r.pagibig.er) },
    { label: 'Total', map: (r) => W.money(r.pagibig.total) },
];

function generate(agg, ctx, format = 'txt') {
    const base = filenameBase({ period: agg.period, profile: ctx.profile });

    if (format === 'csv') {
        return { filename: `${base}.csv`, contentType: 'text/csv;charset=utf-8', body: W.csv(CSV_COLUMNS, agg.rows) };
    }
    return {
        filename: `${base}.${format === 'dat' ? 'dat' : 'txt'}`,
        contentType: 'text/plain;charset=utf-8',
        body: buildText({ ...agg, profile: ctx.profile }),
    };
}

module.exports = { generate, formats: ['txt', 'dat', 'csv'], CSV_COLUMNS };
