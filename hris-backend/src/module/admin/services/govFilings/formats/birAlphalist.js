// src/module/admin/services/govFilings/formats/birAlphalist.js
//
// BIR Alphabetical List of Employees for BIR Form 1604-C (annual).
//
// Produces the BIR "Alphalist Data Entry" .DAT (comma-delimited, CRLF) plus a
// per-schedule CSV mirror for reconciliation.
//
// !! SPEC CAVEAT !!
// The 1604-C DAT layout has ~40 fields per detail record and BIR revises it
// most years. What is implemented here is a representative rendering of the
// published structure:
//
//   H1604C, <year>, <ret. period MM/YYYY>, <TIN9>, <branch3>,
//           <employer name>, <RDO>, <address>, <signatory>, <position>, <signatory TIN>
//   D<sched>, <seq>, <TIN9>, <branch3>, <last>, <first>, <middle>,
//           <period from MM/DD/YYYY>, <period to MM/DD/YYYY>,
//           <gross compensation>, <non-taxable 13th month & other benefits>,
//           <non-taxable de minimis>, <non-taxable SSS/PHIC/HDMF/union dues>,
//           <non-taxable salaries (MWE etc.)>, <total non-taxable>,
//           <taxable compensation>, <tax due>, <tax withheld>,
//           <tax withheld & remitted (Jan-Nov)>, <tax withheld (Dec)>
//   C1604C, <total employees>, <total gross>, <total taxable>, <total tax due>, <total tax withheld>
//
// Schedules:
//   7.1  employees terminated before year-end
//   7.2  employees whose compensation is subject to withholding tax
//   7.3  minimum-wage earners
//   7.4  employees whose compensation income is exempt (non-MWE)
//
// ALWAYS validate the output against the current BIR Alphalist Data Entry /
// validation module before submission.

const W = require('./writers');

const scheduleOf = (r) => {
    if (r.terminated) return '7.1';
    if (r.isMWE) return '7.3';
    if (r.isTaxExempt) return '7.4';
    return '7.2';
};

const filenameBase = ({ year, profile }) => `BIR-Alphalist-1604C_${W.digits(profile?.tin) || 'TIN'}_${year}`;

function detailRecord(r, seq, year) {
    const nonTaxOther = W.money(r.thirteenthMonthAndOther);
    const nonTaxMandatory = W.money(r.mandatoryContributionsEE);
    const nonTaxSalary = W.money(r.isMWE ? Math.max(0, r.grossCompensation - r.thirteenthMonthAndOther - r.mandatoryContributionsEE) : 0);
    const totalNonTax = W.money(r.nonTaxableCompensation + r.thirteenthMonthAndOther
        + (r.isMWE ? Math.max(0, r.grossCompensation - r.thirteenthMonthAndOther - r.mandatoryContributionsEE) : 0));

    return W.row([
        `D${scheduleOf(r)}`,
        seq,
        W.padL(W.digits(r.tin), 9),
        '000',
        W.upper(r.lastName),
        W.upper(r.firstName),
        W.upper(r.middleName),
        r.terminated ? W.mdy(`${year}-01-01`) : W.mdy(`${year}-01-01`),
        r.terminated && r.separationDate ? W.mdy(r.separationDate) : W.mdy(`${year}-12-31`),
        W.money(r.grossCompensation),
        nonTaxOther,
        W.money(0), // de minimis — not separately modelled
        nonTaxMandatory,
        nonTaxSalary,
        totalNonTax,
        W.money(r.taxableCompensation),
        W.money(r.taxDue),
        W.money(r.taxWithheld),
        W.money(r.taxWithheld), // Jan-Nov remitted — approximation
        W.money(0),             // December withheld — approximation
    ]);
}

function buildDat(agg, profile) {
    const { rows, totals, period } = agg;
    const lines = [];

    lines.push(W.row([
        'H1604C',
        period.year,
        W.monthYear(period.year, 12),
        W.padL(W.digits(profile?.tin), 9),
        W.padL(W.digits(profile?.tin_branch) || '000', 3),
        W.upper(profile?.legal_name),
        profile?.rdo_code || '',
        W.upper([profile?.address_line1, profile?.address_line2, profile?.city, profile?.province, profile?.zip_code].filter(Boolean).join(' ')),
        W.upper(profile?.signatory_name),
        W.upper(profile?.signatory_position),
        W.padL(W.digits(profile?.signatory_tin), 9),
    ]));

    rows.forEach((r, i) => lines.push(detailRecord(r, i + 1, period.year)));

    lines.push(W.row([
        'C1604C',
        rows.length,
        W.money(totals.grossCompensation),
        W.money(totals.taxableCompensation),
        W.money(totals.taxDue),
        W.money(totals.taxWithheld),
    ]));

    return W.file(lines);
}

const CSV_COLUMNS = [
    { label: 'Schedule', map: scheduleOf },
    { label: 'TIN', map: (r) => W.digits(r.tin) },
    { label: 'Last Name', map: (r) => W.upper(r.lastName) },
    { label: 'First Name', map: (r) => W.upper(r.firstName) },
    { label: 'Middle Name', map: (r) => W.upper(r.middleName) },
    { label: 'Status', map: (r) => (r.terminated ? `Terminated ${W.mdy(r.separationDate)}` : 'Active') },
    { label: 'Months', key: 'monthsWorked' },
    { label: 'Gross Compensation', map: (r) => W.money(r.grossCompensation) },
    { label: '13th Month & Other Benefits', map: (r) => W.money(r.thirteenthMonthAndOther) },
    { label: 'Mandatory Contributions (EE)', map: (r) => W.money(r.mandatoryContributionsEE) },
    { label: 'Total Non-Taxable', map: (r) => W.money(r.nonTaxableCompensation) },
    { label: 'Taxable Compensation', map: (r) => W.money(r.taxableCompensation) },
    { label: 'Tax Due', map: (r) => W.money(r.taxDue) },
    { label: 'Tax Withheld', map: (r) => W.money(r.taxWithheld) },
    { label: 'Over / (Under) Withheld', map: (r) => W.money(r.taxWithheld - r.taxDue) },
];

function generate(agg, ctx, format = 'dat') {
    const base = filenameBase({ year: agg.period.year, profile: ctx.profile });

    if (format === 'csv') {
        return { filename: `${base}.csv`, contentType: 'text/csv;charset=utf-8', body: W.csv(CSV_COLUMNS, agg.rows) };
    }
    return {
        filename: `${base}.dat`,
        contentType: 'text/plain;charset=utf-8',
        body: buildDat(agg, ctx.profile),
    };
}

module.exports = { generate, formats: ['dat', 'csv'], CSV_COLUMNS, scheduleOf };
