/**
 * In-house SMS sender.
 *
 * There is no third-party gateway wired up yet. `sendSms` simply logs the
 * message to the server console (and, in non-production, the OTP flows also
 * echo the code back in the API response so it can be tested end to end).
 *
 * When a real provider (Twilio, Semaphore, an SMPP gateway, etc.) is ready,
 * implement it inside `deliver()` below — nothing else in the codebase needs
 * to change.
 */

const PROVIDER = process.env.SMS_PROVIDER || 'console';

/**
 * Normalise a local PH-style number to E.164 as a best effort.
 * Leaves anything that already looks international untouched.
 */
function toE164(raw) {
    if (!raw) return raw;
    const n = String(raw).trim().replace(/[\s()-]/g, '');
    if (n.startsWith('+')) return n;
    if (n.startsWith('09') && n.length === 11) return '+63' + n.slice(1);
    if (n.startsWith('63')) return '+' + n;
    if (n.startsWith('9') && n.length === 10) return '+63' + n;
    return n;
}

async function deliver(to, body) {
    switch (PROVIDER) {
        // case 'twilio': ...
        // case 'semaphore': ...
        case 'console':
        default:
            console.log(`\n📨 [SMS:${PROVIDER}] -> ${to}\n   ${body}\n`);
            return { provider: PROVIDER, to, delivered: true, stub: true };
    }
}

/**
 * @param {string} to   destination number (any reasonable format; coerced to E.164)
 * @param {string} body message text
 */
async function sendSms(to, body) {
    const destination = toE164(to);
    return deliver(destination, body);
}

module.exports = { sendSms, toE164 };
