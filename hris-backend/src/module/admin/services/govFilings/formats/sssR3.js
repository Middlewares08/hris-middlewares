// src/module/admin/services/govFilings/formats/sssR3.js
//
// SSS Contribution Collection List (R3) — electronic collection file.
//
// Layout implemented (pipe-delimited text, CRLF), per the SSS employer-portal
// "R3 file" spec. VERIFY against the current SSS validation module before filing:
//
//   H|<ER No>|<Applicable Period MM/YYYY>|<Members>|<Total SS EE>|<Total SS ER>|<Total EC>
//   D|<SS No>|<Last>|<First>|<Middle>|<Suffix>|<SS EE>|<SS ER>|<EC ER>
//   T|<Members>|<Total EE+ER+EC>
//
// A readable CSV mirror is also produced (`format: 'csv'`).

const W = require('./writers');

const filenameBase = ({ period, profile }) => {
    const er = W.digits(profile?.sss_employer_no) || 'ER';
    return `SSS-R3_${er}_${period.year}${String(period.month).padStart(2, '0')}`;
};

function buildText({ rows, totals, period, profile }) {
    const lines = [];
    lines.push(W.row([
        'H',
        profile?.sss_employer_no || '',
        W.monthYear(period.year, period.month),
        rows.length,
        W.money(totals.sss.ee),
        W.money(totals.sss.er),
        W.money(totals.sss.ec),
    ], '|'));

    for (const r of rows) {
        lines.push(W.row([
            'D',
            W.sssNo(r.sssNo),
            W.upper(r.lastName),
            W.upper(r.firstName),
            W.upper(r.middleName),
            '', // suffix — not modelled
            W.money(r.sss.ee),
            W.money(r.sss.er),
            W.money(r.sss.ec),
        ], '|'));
    }

    lines.push(W.row([
        'T',
        rows.length,
        W.money(totals.sss.total),
    ], '|'));

    return W.file(lines);
}

const CSV_COLUMNS = [
    { label: 'SSS Number', map: (r) => W.sssNo(r.sssNo) },
    { label: 'Last Name', map: (r) => W.upper(r.lastName) },
    { label: 'First Name', map: (r) => W.upper(r.firstName) },
    { label: 'Middle Name', map: (r) => W.upper(r.middleName) },
    { label: 'TIN', key: 'tin' },
    { label: 'Monthly Salary Credit', map: (r) => W.money(r.sss.msc) },
    { label: 'SS Contribution (EE)', map: (r) => W.money(r.sss.ee) },
    { label: 'SS Contribution (ER)', map: (r) => W.money(r.sss.er) },
    { label: 'EC Contribution (ER)', map: (r) => W.money(r.sss.ec) },
    { label: 'Total', map: (r) => W.money(r.sss.total) },
];

/**
 * @param {object} agg  monthlyContributions() output
 * @param {object} ctx  { profile }
 * @param {'dat'|'txt'|'csv'} format
 * @returns {{ filename, contentType, body }}
 */
function generate(agg, ctx, format = 'txt') {
    const payload = { ...agg, profile: ctx.profile };
    const base = filenameBase(payload);

    if (format === 'csv') {
        return {
            filename: `${base}.csv`,
            contentType: 'text/csv;charset=utf-8',
            body: W.csv(CSV_COLUMNS, agg.rows),
        };
    }
    return {
        filename: `${base}.${format === 'dat' ? 'dat' : 'txt'}`,
        contentType: 'text/plain;charset=utf-8',
        body: buildText(payload),
    };
}

module.exports = { generate, formats: ['txt', 'dat', 'csv'], CSV_COLUMNS };
