/**
 * In-house email sender.
 *
 * Providers (set MAIL_PROVIDER):
 *   - `console` (default) — logs the message to the server console. Callers
 *     outside production may additionally echo the composed body back in their
 *     API response (a `devPreview`) so a flow can be tested end to end.
 *   - `smtp` — real delivery via nodemailer over SMTP. Works with any SMTP
 *     provider (Gmail, AWS SES, SendGrid, Mailgun, Postmark, Resend, Brevo, …).
 *     Needs SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS (see .env.example).
 *
 * Adding another transport means one more `case` in `deliver()` — nothing else
 * in the codebase changes. Mirrors the shape of ./sms.js on purpose.
 */

const PROVIDER = process.env.MAIL_PROVIDER || 'console';
const DEFAULT_FROM = process.env.MAIL_FROM || 'HRIS <no-reply@hris.local>';

// Lazily-built nodemailer transport, so `nodemailer` is only required when
// MAIL_PROVIDER=smtp is actually in use.
let _smtpTransport = null;
function smtpTransport() {
    if (_smtpTransport) return _smtpTransport;

    const host = process.env.SMTP_HOST;
    if (!host) {
        throw new Error('MAIL_PROVIDER=smtp but SMTP_HOST is not set.');
    }

    const nodemailer = require('nodemailer');
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    const secure = process.env.SMTP_SECURE
        ? /^(1|true|yes)$/i.test(process.env.SMTP_SECURE)
        : port === 465; // implicit TLS on 465, STARTTLS otherwise

    _smtpTransport = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
        pool: true, // reuse connections for bursts (e.g. payroll-approved fan-out)
        // Fail fast instead of wedging a request (login OTP awaits this send).
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
    });
    return _smtpTransport;
}

async function deliver({ to, from, subject, text, html, replyTo }) {
    switch (PROVIDER) {
        case 'smtp': {
            const info = await smtpTransport().sendMail({ to, from, subject, text, html, replyTo });
            return { provider: 'smtp', to, delivered: true, messageId: info.messageId };
        }

        // case 'ses': ...  (SES SMTP works through the `smtp` case above)

        case 'console':
        default:
            console.log(
                `\n📧 [MAIL:${PROVIDER}] -> ${to}\n` +
                `   from: ${from}\n` +
                `   reply-to: ${replyTo || '—'}\n` +
                `   subject: ${subject}\n\n` +
                `${text || html || ''}\n`,
            );
            return { provider: PROVIDER, to, delivered: true, stub: true };
    }
}

/**
 * @param {object} opts
 * @param {string} opts.to        destination address
 * @param {string} [opts.from]    sender (defaults to MAIL_FROM)
 * @param {string} opts.subject
 * @param {string} [opts.text]    plain-text body
 * @param {string} [opts.html]    html body
 * @param {string} [opts.replyTo] Reply-To header
 */
async function sendMail({ to, from, subject, text, html, replyTo } = {}) {
    if (!to) throw new Error('sendMail: "to" is required');
    return deliver({
        to,
        from: from || DEFAULT_FROM,
        subject: subject || '(no subject)',
        text,
        html,
        replyTo,
    });
}

module.exports = { sendMail };
