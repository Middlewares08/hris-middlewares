// src/utils/payslipPdf.js
//
// Renders a payslip (a `payroll.payslips` row with its `lines` + `run.period` +
// `employee` graph loaded) into a branded PDF and returns it as a Buffer.
//
// Company identity is read from the environment with sensible fallbacks:
//   COMPANY_NAME      -> header title            (default "Support Community")
//   COMPANY_ADDRESS   -> small line under name   (default blank)
//   COMPANY_LOGO_PATH -> absolute/relative path  (default src/assets/company-logo.png)

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const DEFAULT_LOGO = path.join(__dirname, '..', 'assets', 'company-logo.png');

// PDFKit's built-in Helvetica is WinAnsi-encoded and has no ₱ / − glyphs, so we spell
// out "PHP" and use an ASCII hyphen.
const peso = (value) => {
    const n = Number(value) || 0;
    return `PHP ${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtDate = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

const titleCase = (value) =>
    String(value || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

function companyConfig() {
    return {
        companyName: process.env.COMPANY_NAME || 'Support Community',
        companyAddress: process.env.COMPANY_ADDRESS || '',
        logoPath: process.env.COMPANY_LOGO_PATH || DEFAULT_LOGO,
    };
}

function employeeName(employee, fallbackId) {
    if (employee && (employee.first_name || employee.last_name)) {
        return `${employee.first_name || ''} ${employee.last_name || ''}`.trim();
    }
    return `Employee #${fallbackId}`;
}

function periodLabel(payslip) {
    const period = payslip.run && payslip.run.period;
    if (period && period.name) return period.name;
    if (period && period.period_start && period.period_end) {
        return `${fmtDate(period.period_start)} – ${fmtDate(period.period_end)}`;
    }
    return 'Payslip';
}

/**
 * @param {object} payslip  A Payslip model instance / plain row with `lines`,
 *                           `run.period` and `employee` (ideally `employee.position.department`).
 * @param {object} [options] Overrides for company identity (defaults from env).
 * @returns {Promise<Buffer>}
 */
function buildPayslipPdfBuffer(payslip, options = {}) {
    const cfg = { ...companyConfig(), ...options };

    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 48 });
            const chunks = [];
            doc.on('data', (c) => chunks.push(c));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const pageLeft = doc.page.margins.left;
            const pageRight = doc.page.width - doc.page.margins.right;
            const contentWidth = pageRight - pageLeft;

            const lines = Array.isArray(payslip.lines) ? payslip.lines : [];
            const earnings = lines.filter((l) => l.line_type === 'earning');
            const deductions = lines.filter((l) => l.line_type === 'deduction');
            const employerContribs = lines.filter((l) => l.line_type === 'employer_contribution');

            const employee = payslip.employee || null;
            const position = employee && employee.position;
            const department = position && position.department;

            /* ---------------------------------------------------------------- Header */
            let headerBottom = doc.y;
            try {
                if (cfg.logoPath && fs.existsSync(cfg.logoPath)) {
                    doc.image(cfg.logoPath, pageLeft, doc.y, { fit: [46, 46] });
                }
            } catch {
                /* non-fatal — render without the logo */
            }

            const textX = pageLeft + 58;
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(15)
                .text(cfg.companyName, textX, doc.page.margins.top, { width: contentWidth - 58 });
            if (cfg.companyAddress) {
                doc.font('Helvetica').fontSize(9).fillColor('#64748b')
                    .text(cfg.companyAddress, textX, doc.y + 1, { width: contentWidth - 58 });
            }

            doc.font('Helvetica-Bold').fontSize(13).fillColor('#6d28d9')
                .text('PAYSLIP', pageLeft, doc.page.margins.top, { width: contentWidth, align: 'right' });

            headerBottom = Math.max(doc.y, doc.page.margins.top + 46);
            doc.moveTo(pageLeft, headerBottom + 10).lineTo(pageRight, headerBottom + 10)
                .strokeColor('#e2e8f0').lineWidth(1).stroke();
            doc.y = headerBottom + 22;

            /* ---------------------------------------------------- Employee / period */
            const colGap = 24;
            const colWidth = (contentWidth - colGap) / 2;
            const blockTop = doc.y;

            const kv = (x, label, value) => {
                doc.font('Helvetica').fontSize(8).fillColor('#94a3b8')
                    .text(String(label).toUpperCase(), x, doc.y, { width: colWidth });
                doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b')
                    .text(value || '—', x, doc.y + 1, { width: colWidth });
                doc.moveDown(0.5);
            };

            doc.y = blockTop;
            doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569')
                .text('EMPLOYEE', pageLeft, doc.y);
            doc.moveDown(0.3);
            kv(pageLeft, 'Name', employeeName(employee, payslip.employee_id));
            kv(pageLeft, 'Employee ID', employee && employee.employee_id ? employee.employee_id : `#${payslip.employee_id}`);
            kv(pageLeft, 'Position', position && position.name ? position.name : '—');
            kv(pageLeft, 'Department', department && department.name ? department.name : '—');
            const leftBottom = doc.y;

            const rightX = pageLeft + colWidth + colGap;
            doc.y = blockTop;
            doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569')
                .text('PAY PERIOD', rightX, doc.y);
            doc.moveDown(0.3);
            const period = payslip.run && payslip.run.period;
            kv(rightX, 'Period', periodLabel(payslip));
            kv(rightX, 'Coverage', period ? `${fmtDate(period.period_start)} – ${fmtDate(period.period_end)}` : '—');
            kv(rightX, 'Pay Date', period ? fmtDate(period.pay_date) : '—');
            kv(rightX, 'Run / Status', `#${(payslip.run && payslip.run.run_number) || 1} · ${titleCase(payslip.status)}`);
            const rightBottom = doc.y;

            doc.y = Math.max(leftBottom, rightBottom) + 8;

            /* --------------------------------------------------------- Line tables */
            const amountX = pageRight - 130;
            const amountWidth = 130;

            const drawTable = (heading, rows, { sign = '', color = '#1e293b' } = {}) => {
                if (!rows.length) return;
                doc.moveDown(0.6);
                doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569')
                    .text(heading.toUpperCase(), pageLeft, doc.y);
                doc.moveDown(0.2);
                doc.moveTo(pageLeft, doc.y).lineTo(pageRight, doc.y)
                    .strokeColor('#e2e8f0').lineWidth(0.5).stroke();
                doc.moveDown(0.35);

                rows.forEach((row) => {
                    const y = doc.y;
                    doc.font('Helvetica').fontSize(10).fillColor('#334155')
                        .text(row.label || '—', pageLeft, y, { width: amountX - pageLeft - 10 });
                    doc.font('Helvetica').fontSize(10).fillColor(color)
                        .text(`${sign}${peso(row.amount)}`, amountX, y, { width: amountWidth, align: 'right' });
                    doc.y = Math.max(doc.y, y) + 2;
                });
            };

            drawTable('Earnings', earnings, { sign: '', color: '#047857' });
            drawTable('Deductions', deductions, { sign: '- ', color: '#b91c1c' });
            drawTable('Employer Contributions (not deducted)', employerContribs, { color: '#64748b' });

            /* ------------------------------------------------------------- Summary */
            doc.moveDown(1);
            const boxTop = doc.y;
            const summaryRows = [
                ['Gross Pay', peso(payslip.gross_pay)],
                ['Taxable Income', peso(payslip.taxable_income)],
                ['Withholding Tax', peso(payslip.withholding_tax)],
                ['Total Deductions', `- ${peso(payslip.total_deductions)}`],
            ];
            const boxHeight = 20 * summaryRows.length + 44;
            doc.roundedRect(pageLeft, boxTop, contentWidth, boxHeight, 8)
                .fillColor('#f8fafc').fill();

            let sy = boxTop + 12;
            summaryRows.forEach(([label, value]) => {
                doc.font('Helvetica').fontSize(10).fillColor('#475569')
                    .text(label, pageLeft + 16, sy, { width: contentWidth / 2 });
                doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b')
                    .text(value, pageLeft + contentWidth / 2, sy, { width: contentWidth / 2 - 16, align: 'right' });
                sy += 20;
            });
            doc.moveTo(pageLeft + 16, sy + 2).lineTo(pageRight - 16, sy + 2)
                .strokeColor('#e2e8f0').lineWidth(1).stroke();
            sy += 12;
            doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a')
                .text('NET PAY', pageLeft + 16, sy, { width: contentWidth / 2 });
            doc.font('Helvetica-Bold').fontSize(13).fillColor('#6d28d9')
                .text(peso(payslip.net_pay), pageLeft + contentWidth / 2, sy - 1, { width: contentWidth / 2 - 16, align: 'right' });

            doc.y = boxTop + boxHeight + 16;

            /* ------------------------------------------------- Attendance + payment */
            doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569')
                .text('ATTENDANCE & PAYMENT', pageLeft, doc.y);
            doc.moveDown(0.4);
            const facts = [
                ['Days Worked', payslip.days_worked ?? 0],
                ['Days Absent', payslip.days_absent ?? 0],
                ['Overtime Hours', payslip.overtime_hours ?? 0],
                ['Late (min)', payslip.late_minutes ?? 0],
                ['Payment Method', titleCase(payslip.payment_method)],
                ['Reference', payslip.payment_reference || '—'],
            ];
            const factColW = contentWidth / 3;
            const factsTop = doc.y;
            facts.forEach(([label, value], i) => {
                const col = i % 3;
                const rowIdx = Math.floor(i / 3);
                const x = pageLeft + col * factColW;
                const y = factsTop + rowIdx * 34;
                doc.font('Helvetica').fontSize(8).fillColor('#94a3b8')
                    .text(String(label).toUpperCase(), x, y, { width: factColW - 8 });
                doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b')
                    .text(String(value), x, y + 10, { width: factColW - 8 });
            });
            doc.y = factsTop + 34 * Math.ceil(facts.length / 3) + 12;

            /* -------------------------------------------------------------- Footer */
            doc.moveTo(pageLeft, doc.y).lineTo(pageRight, doc.y)
                .strokeColor('#e2e8f0').lineWidth(0.5).stroke();
            doc.moveDown(0.5);
            doc.font('Helvetica').fontSize(8).fillColor('#94a3b8')
                .text(
                    `This is a system-generated payslip and does not require a signature. Generated ${new Date().toLocaleString('en-PH')}.`,
                    pageLeft, doc.y, { width: contentWidth, align: 'center' },
                );

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = { buildPayslipPdfBuffer, companyConfig };
