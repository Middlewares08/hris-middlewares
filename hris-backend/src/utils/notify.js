/**
 * Employee-facing email notifications.
 *
 * Fire-and-forget by design: a delivery failure here must never break the admin
 * action that triggered it, so every path is wrapped and nothing throws. Delivery
 * goes through ./mailer (MAIL_PROVIDER=console logs; =smtp really sends).
 *
 * Respects the employee's notification preferences (the jsonb bag on
 * employee.employees.preferences — same shape as PREFERENCE_REGISTRY in
 * auth.controller.js; every opt-in defaults ON, channel defaults to 'email'):
 *   - notification_channel 'none' or 'sms'  -> no email
 *   - the per-event opt-in flag set to false -> no email
 */

require('../database/connection');
const Employee = require('../database/models/employee/Employee');
const { sendMail } = require('./mailer');

const COMPANY = process.env.COMPANY_NAME || 'HRIS';
const PORTAL_URL = String(process.env.EMPLOYEE_PORTAL_URL || '').replace(/\/+$/, '');

// event key -> the preference flag that gates it.
const EVENT_PREFERENCE = {
    document_request: 'notify_document_updates',
    payslip_request_fulfilled: 'notify_payslip_released',
    payroll_approved: 'notify_payslip_released',
};

const greetingName = (e) => e?.preferred_name || e?.first_name || 'there';

const portalLink = (path = '') => {
    if (!PORTAL_URL) return null;
    return `${PORTAL_URL}/${String(path).replace(/^\/+/, '')}`;
};

/**
 * Compose and send one notification email to an employee.
 *
 * @param {object}  opts
 * @param {number}  opts.employeeId
 * @param {string}  opts.event       key in EVENT_PREFERENCE
 * @param {string}  opts.subject
 * @param {string[]} opts.lines      body paragraphs (between greeting and sign-off)
 * @param {{label:string, path?:string}} [opts.cta]  call-to-action line
 * @returns {Promise<{sent:boolean, to?:string, reason?:string}>}
 */
async function notifyEmployee({ employeeId, event, subject, lines = [], cta }) {
    try {
        if (!employeeId) return { sent: false, reason: 'no employee id' };

        const employee = await Employee.query()
            .findById(employeeId)
            .select('id', 'first_name', 'preferred_name', 'preferences')
            .withGraphFetched('[contact, credentials]');

        if (!employee) return { sent: false, reason: 'employee not found' };

        const to = employee.contact?.personal_email || employee.credentials?.email || null;
        if (!to) return { sent: false, reason: 'no email on file' };

        const prefs = employee.preferences || {};
        const channel = prefs.notification_channel || 'email';
        if (channel === 'none' || channel === 'sms') {
            return { sent: false, reason: `notification_channel is "${channel}"` };
        }
        const gate = EVENT_PREFERENCE[event];
        if (gate && prefs[gate] === false) {
            return { sent: false, reason: `opted out (${gate})` };
        }

        const ctaLine = cta
            ? (portalLink(cta.path) ? `${cta.label}: ${portalLink(cta.path)}` : cta.label)
            : null;

        const text = [
            `Hi ${greetingName(employee)},`,
            '',
            ...lines,
            ...(ctaLine ? ['', ctaLine] : []),
            '',
            `— ${COMPANY} HRIS`,
        ].join('\n');

        await sendMail({ to, subject, text });
        return { sent: true, to };
    } catch (error) {
        console.error(`notifyEmployee(${event}) failed:`, error.message);
        return { sent: false, reason: error.message };
    }
}

/* ------------------------------------------------------------------ *
 * Event helpers — one per trigger. Each returns the notifyEmployee
 * result(s); callers may await or fire-and-forget.
 * ------------------------------------------------------------------ */

/** HR raised a document request against the employee (admin -> employee). */
function notifyDocumentRequested({ employeeId, label, note, dueDate }) {
    const lines = [`HR has requested a document from you: "${label}".`];
    if (note) lines.push('', `Note from HR: ${note}`);
    if (dueDate) lines.push('', `Please provide it by ${dueDate}.`);

    return notifyEmployee({
        employeeId,
        event: 'document_request',
        subject: `Document requested: ${label}`,
        lines,
        cta: { label: 'Upload it from the employee portal', path: 'documents' },
    });
}

/** HR fulfilled the employee's payslip-copy request. */
function notifyPayslipRequestFulfilled({ employeeId, periodName, remarks }) {
    const lines = [
        `Your payslip copy request${periodName ? ` for ${periodName}` : ''} has been fulfilled by HR.`,
    ];
    if (remarks) lines.push('', `Note from HR: ${remarks}`);

    return notifyEmployee({
        employeeId,
        event: 'payslip_request_fulfilled',
        subject: `Your payslip copy is ready${periodName ? ` — ${periodName}` : ''}`,
        lines,
        cta: { label: 'View and download it from the employee portal', path: 'payroll' },
    });
}

/**
 * A payroll run was approved — notify every employee who has a payslip in it.
 * Loads the run's period name + payslip recipients itself.
 *
 * @param {number} runId  payroll.payroll_runs.id
 * @returns {Promise<{notified:number, total:number}>}
 */
async function notifyPayrollRunApproved({ runId }) {
    try {
        const PayrollRun = require('../database/models/payroll/PayrollRun');
        const Payslip = require('../database/models/payroll/Payslip');

        const run = await PayrollRun.query()
            .findById(runId)
            .select('id', 'pay_period_id')
            .withGraphFetched('period');
        const periodName = run?.period?.name || null;

        const rows = await Payslip.query()
            .where({ payroll_run_id: runId, is_deleted: false })
            .distinct('employee_id');
        const employeeIds = rows.map((r) => r.employee_id);

        const results = await Promise.all(
            employeeIds.map((employeeId) =>
                notifyEmployee({
                    employeeId,
                    event: 'payroll_approved',
                    subject: `Payroll approved${periodName ? ` — ${periodName}` : ''}`,
                    lines: [
                        `Payroll${periodName ? ` for ${periodName}` : ''} has been approved.`,
                        '',
                        'Your payslip will be available in the employee portal once it is released for payment.',
                    ],
                    cta: { label: 'Open the employee portal', path: 'payroll' },
                }),
            ),
        );

        const notified = results.filter((r) => r.sent).length;
        return { notified, total: employeeIds.length };
    } catch (error) {
        console.error('notifyPayrollRunApproved failed:', error.message);
        return { notified: 0, total: 0 };
    }
}

module.exports = {
    notifyEmployee,
    notifyDocumentRequested,
    notifyPayslipRequestFulfilled,
    notifyPayrollRunApproved,
};
