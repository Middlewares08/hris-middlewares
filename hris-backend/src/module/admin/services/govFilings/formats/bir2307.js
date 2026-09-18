// src/module/admin/services/govFilings/formats/bir2307.js
//
// BIR Form 2307 — Certificate of Creditable Tax Withheld at Source (Expanded).
// One page per payee in a single PDF (the copy handed to each payee).
//
// This is a readable rendering of the official form's key fields — not a pixel-exact
// BIR pre-printed form. Figures come straight from quarterlyEWT(); confirm ATC codes
// and rates against the current BIR withholding tax table before signing.

const PDFDocument = require('pdfkit');
const W = require('./writers');

const peso = (v) => `PHP ${(Number(v) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (v) => `${(Number(v) * 100).toFixed(2)}%`;
const fmtDate = (v) => (v ? W.mdy(v) : '—');
const QUARTER_LABEL = { 1: 'Q1 (Jan–Mar)', 2: 'Q2 (Apr–Jun)', 3: 'Q3 (Jul–Sep)', 4: 'Q4 (Oct–Dec)' };

function drawPayeePage(doc, r, ctx, first) {
    if (!first) doc.addPage();
    const { profile, period } = ctx;
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;

    // Header
    const top = doc.page.margins.top;
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#0f172a')
        .text('BIR FORM 2307', left, top);
    doc.font('Helvetica').fontSize(9).fillColor('#475569')
        .text('Certificate of Creditable Tax Withheld at Source (Expanded)', left, doc.y + 2);
    const subtitleBottom = doc.y;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b')
        .text(`For the Quarter ${QUARTER_LABEL[period.quarter] || period.quarter} ${period.year}`, left, top, { width, align: 'right' });
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
        const top2 = doc.y;
        field(l1, v1, left, half());
        const afterLeft = doc.y;
        doc.y = top2;
        field(l2, v2, left + half() + 12, half());
        doc.y = Math.max(afterLeft, doc.y);
    };

    // Part I — Payee
    section('PART I — PAYEE INFORMATION');
    row2('TIN', W.tin12(r.tin, r.tinBranch), 'Payee name', W.upper(r.registeredName));
    row2('Trade name', r.tradeName || '—', 'Payee type', r.payeeType === 'non_individual' ? 'NON-INDIVIDUAL' : 'INDIVIDUAL');
    field('Registered address', r.address || '—', left, width);

    // Part II — Withholding agent
    section('PART II — WITHHOLDING AGENT INFORMATION');
    row2('TIN', W.tin12(profile?.tin, profile?.tin_branch), 'Withholding agent name', W.upper(profile?.legal_name));
    field('Registered address', [profile?.address_line1, profile?.address_line2, profile?.city, profile?.province, profile?.zip_code].filter(Boolean).join(', ') || '—', left, width);
    row2('RDO code', profile?.rdo_code || '—', 'Period covered', `${fmtDate(period.from)} to ${fmtDate(period.to)}`);

    // Part III — income payments table
    section('PART III — DETAILS OF INCOME PAYMENTS / TAX WITHHELD');
    const colX = { atc: left, desc: left + 60, income: left + 260, rate: left + 350, tax: left + 410 };
    const colW = { atc: 58, desc: 198, income: 88, rate: 58, tax: width - 410 };

    const headerY = doc.y;
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#64748b');
    doc.text('ATC', colX.atc, headerY, { width: colW.atc });
    doc.text('NATURE OF INCOME PAYMENT', colX.desc, headerY, { width: colW.desc });
    doc.text('INCOME PAYMENT', colX.income, headerY, { width: colW.income, align: 'right' });
    doc.text('RATE', colX.rate, headerY, { width: colW.rate, align: 'right' });
    doc.text('TAX WITHHELD', colX.tax, headerY, { width: colW.tax, align: 'right' });
    doc.y = headerY + 11;
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.y += 4;

    doc.font('Helvetica').fontSize(8).fillColor('#1e293b');
    for (const p of r.payments) {
        const rowY = doc.y;
        doc.text(p.atcCode, colX.atc, rowY, { width: colW.atc });
        doc.text(p.atcDescription, colX.desc, rowY, { width: colW.desc });
        doc.text(peso(p.incomePayment), colX.income, rowY, { width: colW.income, align: 'right' });
        doc.text(pct(p.taxRate), colX.rate, rowY, { width: colW.rate, align: 'right' });
        doc.text(peso(p.taxWithheld), colX.tax, rowY, { width: colW.tax, align: 'right' });
        doc.y = Math.max(doc.y, rowY + 12);
    }

    doc.moveTo(left, doc.y + 2).lineTo(right, doc.y + 2).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
    doc.y += 6;
    const totalY = doc.y;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1e293b');
    doc.text('TOTAL', colX.desc, totalY, { width: colW.desc });
    doc.text(peso(r.totalIncomePayment), colX.income, totalY, { width: colW.income, align: 'right' });
    doc.text(peso(r.totalTaxWithheld), colX.tax, totalY, { width: colW.tax, align: 'right' });
    doc.y = totalY + 14;
    doc.moveDown(1.2);

    // Signatures
    const sigY = doc.y;
    const sigW = half();
    doc.font('Helvetica').fontSize(7).fillColor('#94a3b8')
        .text('WITHHOLDING AGENT / AUTHORIZED REPRESENTATIVE', left, sigY, { width: sigW });
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b')
        .text(W.upper(profile?.signatory_name) || '________________________', left, sigY + 14, { width: sigW });
    doc.font('Helvetica').fontSize(7.5).fillColor('#64748b')
        .text(profile?.signatory_position || '', left, doc.y + 1, { width: sigW });

    doc.font('Helvetica').fontSize(7).fillColor('#94a3b8')
        .text('PAYEE (SIGNATURE OVER PRINTED NAME)', left + sigW + 12, sigY, { width: sigW });
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b')
        .text(W.upper(r.registeredName), left + sigW + 12, sigY + 14, { width: sigW });

    doc.font('Helvetica-Oblique').fontSize(6.5).fillColor('#94a3b8')
        .text('Generated from recorded EWT payments. Verify ATC codes and rates against the current BIR withholding tax table before signing and filing.',
            left, doc.page.height - doc.page.margins.bottom - 20, { width });
}

/**
 * @param {object} agg    quarterlyEWT() output
 * @param {object} ctx    { profile }
 * @param {'pdf'} _format
 * @param {{ payeeId?: number }} [opts]  restrict to one payee
 * @returns {Promise<{ filename, contentType, body: Buffer }>}
 */
function generate(agg, ctx, _format = 'pdf', opts = {}) {
    return new Promise((resolve, reject) => {
        let rows = agg.rows;
        if (opts.payeeId) rows = rows.filter((r) => r.payeeId === Number(opts.payeeId));
        if (!rows.length) {
            reject(Object.assign(new Error('No payee data for BIR 2307 in this period.'), { status: 404 }));
            return;
        }

        const doc = new PDFDocument({ size: 'A4', margin: 42 });
        const chunks = [];
        doc.on('data', (c) => chunks.push(c));
        doc.on('end', () => resolve({
            filename: opts.payeeId
                ? `BIR-2307_${W.upper(rows[0].registeredName).replace(/\s+/g, '-')}_Q${agg.period.quarter}-${agg.period.year}.pdf`
                : `BIR-2307_${W.digits(ctx.profile?.tin) || 'TIN'}_Q${agg.period.quarter}-${agg.period.year}.pdf`,
            contentType: 'application/pdf',
            body: Buffer.concat(chunks),
        }));
        doc.on('error', reject);

        rows.forEach((r, i) => drawPayeePage(doc, r, { ...ctx, period: agg.period }, i === 0));
        doc.end();
    });
}

module.exports = { generate, formats: ['pdf'] };
