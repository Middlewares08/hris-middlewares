/**
 * In-house email sender.
 *
 * There is no SMTP / API gateway wired up yet. With MAIL_PROVIDER=console (the
 * default) `sendMail` simply logs the message to the server console. Callers
 * outside production may additionally echo the composed body back in their API
 * response (a `devPreview`) so a flow can be tested end to end.
 *
 * When a real provider (nodemailer/SMTP, AWS SES, Postmark, Resend, …) is ready,
 * implement it inside `deliver()` below — nothing else in the codebase needs to
 * change. Mirrors the shape of ./sms.js on purpose.
 */

const PROVIDER = process.env.MAIL_PROVIDER || 'console';
const DEFAULT_FROM = process.env.MAIL_FROM || 'HRIS <no-reply@hris.local>';

async function deliver({ to, from, subject, text, html, replyTo }) {
    switch (PROVIDER) {
        // case 'ses': ...
        // case 'smtp': ...
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
