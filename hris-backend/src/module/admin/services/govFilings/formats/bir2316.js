// src/module/admin/services/govFilings/formats/bir2316.js
//
// BIR Form 2316 — Certificate of Compensation Payment / Tax Withheld.
// One page per employee in a single PDF (the copy handed to each employee).
//
// This is a readable rendering of the official form's Parts I–IV — not a
// pixel-exact BIR pre-printed form. Money figures come straight from
// annualCompensation(); confirm the non-taxable breakdown (de minimis,
// 13th-month split) against the employee's payroll detail before signing.

const PDFDocument = require('pdfkit');
const W = require('./writers');

const peso = (v) => `PHP ${(Number(v) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (v) => (v ? W.mdy(v) : '—');

function drawEmployeePage(doc, r, ctx, first) {
    if (!first) doc.addPage();
    const { profile, period } = ctx;
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;

    // Header
    const top = doc.page.margins.top;
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#0f172a')
        .text('BIR FORM 2316', left, top);
    doc.font('Helvetica').fontSize(9).fillColor('#475569')
        .text('Certificate of Compensation Payment / Tax Withheld', left, doc.y + 2);
    const subtitleBottom = doc.y;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b')
        .text(`For the Year ${period.year}`, left, top, { width, align: 'right' });
    doc.y = subtitleBottom + 8;
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#cbd5e1').lineWidth(1).stroke();
    doc.y += 12;

    const field = (label, value, x, w) => {
        doc.font('Helvetica').fontSize(7).fillColor('#94a3b8').text(String(label).toUpperCase(), x, doc.y, { width: w });
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b').text(value || '—', x, doc.y + 1, { width: w });
        doc.moveDown(0.6);
    };
    const section = (title) => {
        doc.moveDown(0.3);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#6d28d9').text(title, left, doc.y);
        doc.moveDown(0.2);
        doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
        doc.moveDown(0.3);
    };
    const half = (w = width) => w / 2 - 6;
    const row2 = (l1, v1, l2, v2) => {
        const top = doc.y;
        field(l1, v1, left, half());
        const afterLeft = doc.y;
        doc.y = top;
        field(l2, v2, left + half() + 12, half());
        doc.y = Math.max(afterLeft, doc.y);
    };
    const money2 = (l1, v1, l2, v2) => {
        const top = doc.y;
        field(l1, peso(v1), left, half());
        const afterLeft = doc.y;
        doc.y = top;
        field(l2, peso(v2), left + half() + 12, half());
        doc.y = Math.max(afterLeft, doc.y);
    };

    // Part I — Employee
    section('PART I — EMPLOYEE INFORMATION');
    row2('TIN', W.tin12(r.tin), 'Employee name', r.fullName.toUpperCase());
    row2('Date of birth', fmtDate(r.dateOfBirth), 'Contact number', r.phone || '—');
    field('Registered address', r.address || '—', left, width);
    row2('Statutory minimum wage earner', r.isMWE ? 'YES' : 'NO', 'Tax status', r.taxStatus || '—');
    row2('Period covered — from', fmtDate(r.terminated ? `${period.year}-01-01` : `${period.year}-01-01`),
        'Period covered — to', r.terminated && r.separationDate ? fmtDate(r.separationDate) : fmtDate(`${period.year}-12-31`));

    // Part II/III — Employer
    section('PART II — PRESENT EMPLOYER INFORMATION');
    row2('TIN', W.tin12(profile?.tin, profile?.tin_branch), 'Employer name', W.upper(profile?.legal_name));
    field('Registered address', [profile?.address_line1, profile?.address_line2, profile?.city, profile?.province, profile?.zip_code].filter(Boolean).join(', ') || '—', left, width);
    row2('RDO code', profile?.rdo_code || '—', 'Type of employer', 'MAIN EMPLOYER');

    // Part IV-A — Summary
    section('PART IV-A — SUMMARY');
    money2('Gross compensation income', r.grossCompensation, 'Less: total non-taxable / exempt', r.nonTaxableCompensation + r.thirteenthMonthAndOther);
    money2('Taxable compensation income', r.taxableCompensation, 'Tax due', r.taxDue);
    money2('Amount of tax withheld', r.taxWithheld, 'Over / (under) withheld', r.taxWithheld - r.taxDue);

    // Part IV-B — Details
    section('PART IV-B — DETAILS OF COMPENSATION INCOME');
    money2('Basic salary', r.basicSalary, '13th month pay & other benefits', r.thirteenthMonthAndOther);
    money2('SSS contribution (EE)', r.sssEE, 'PhilHealth contribution (EE)', r.philhealthEE);
    money2('Pag-IBIG contribution (EE)', r.pagibigEE, 'Mandatory contributions total', r.mandatoryContributionsEE);
    field('Months with payroll on record', String(r.monthsWorked), left, width);

    // Signatures
    doc.moveDown(1.2);
    const sigY = doc.y;
    const sigW = half();
    doc.font('Helvetica').fontSize(7).fillColor('#94a3b8')
        .text('PRESENT EMPLOYER / AUTHORIZED AGENT', left, sigY, { width: sigW });
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b')
        .text(W.upper(profile?.signatory_name) || '________________________', left, sigY + 14, { width: sigW });
    doc.font('Helvetica').fontSize(7.5).fillColor('#64748b')
        .text(profile?.signatory_position || '', left, doc.y + 1, { width: sigW });

    doc.font('Helvetica').fontSize(7).fillColor('#94a3b8')
        .text('EMPLOYEE (SIGNATURE OVER PRINTED NAME)', left + sigW + 12, sigY, { width: sigW });
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b')
        .text(r.fullName.toUpperCase(), left + sigW + 12, sigY + 14, { width: sigW });

    doc.font('Helvetica-Oblique').fontSize(6.5).fillColor('#94a3b8')
        .text('Generated from payroll records. Verify the non-taxable breakdown (de minimis, 13th-month ceiling) and any prior-employer compensation before signing and filing.',
            left, doc.page.height - doc.page.margins.bottom - 20, { width });
}

/**
 * @param {object} agg    annualCompensation() output
 * @param {object} ctx    { profile }
 * @param {'pdf'} _format
 * @param {{ employeeId?: number }} [opts]  restrict to one employee
 * @returns {Promise<{ filename, contentType, body: Buffer }>}
 */
function generate(agg, ctx, _format = 'pdf', opts = {}) {
    return new Promise((resolve, reject) => {
        let rows = agg.rows;
        if (opts.employeeId) rows = rows.filter((r) => r.employeeId === Number(opts.employeeId));
        if (!rows.length) {
            reject(Object.assign(new Error('No employee data for BIR 2316 in this period.'), { status: 404 }));
            return;
        }

        const doc = new PDFDocument({ size: 'A4', margin: 42 });
        const chunks = [];
        doc.on('data', (c) => chunks.push(c));
        doc.on('end', () => resolve({
            filename: opts.employeeId
                ? `BIR-2316_${W.upper(rows[0].lastName)}_${agg.period.year}.pdf`
                : `BIR-2316_${W.digits(ctx.profile?.tin) || 'TIN'}_${agg.period.year}.pdf`,
            contentType: 'application/pdf',
            body: Buffer.concat(chunks),
        }));
        doc.on('error', reject);

        rows.forEach((r, i) => drawEmployeePage(doc, r, { ...ctx, period: agg.period }, i === 0));
        doc.end();
    });
}

module.exports = { generate, formats: ['pdf'] };
