const crypto = require('crypto');
const OtpCode = require('../database/models/auth/OtpCode');
const { sendSms } = require('./sms');
const { sendMail } = require('./mailer');

const CODE_TTL_MINUTES = parseInt(process.env.OTP_TTL_MINUTES || '10', 10);
const MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);
// Smallest gap between two code requests for the same employee+purpose.
const RESEND_COOLDOWN_SECONDS = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '45', 10);

const COMPANY = process.env.COMPANY_NAME || 'HRIS';

const MESSAGES = {
    login_2fa: (code) => `${code} is your ${COMPANY} sign-in code. It expires in ${CODE_TTL_MINUTES} minutes.`,
    password_reset: (code) => `${code} is your ${COMPANY} password reset code. It expires in ${CODE_TTL_MINUTES} minutes. If this wasn't you, ignore this message.`,
};

const EMAIL_CONTENT = {
    login_2fa: (code) => ({
        subject: `${code} is your ${COMPANY} sign-in code`,
        text:
            `Your ${COMPANY} sign-in verification code is:\n\n` +
            `    ${code}\n\n` +
            `It expires in ${CODE_TTL_MINUTES} minutes. ` +
            `If you didn't try to sign in, you can safely ignore this email.`,
    }),
    password_reset: (code) => ({
        subject: `${code} is your ${COMPANY} password reset code`,
        text:
            `Your ${COMPANY} password reset code is:\n\n` +
            `    ${code}\n\n` +
            `It expires in ${CODE_TTL_MINUTES} minutes. ` +
            `If this wasn't you, ignore this email — your password will not change.`,
    }),
};

/**
 * Deliver the plaintext code over every channel we have a destination for
 * (SMS and/or email). Best-effort per channel: succeeds as long as ONE channel
 * goes through; throws only when every attempted channel failed.
 */
async function deliverCode({ purpose, code, phone, email }) {
    const attempts = [];

    if (phone) {
        attempts.push(
            sendSms(phone, (MESSAGES[purpose] || MESSAGES.login_2fa)(code))
                .then((r) => ({ channel: 'sms', ok: true, stub: !!r?.stub }))
                .catch((error) => ({ channel: 'sms', ok: false, error })),
        );
    }
    if (email) {
        const { subject, text } = (EMAIL_CONTENT[purpose] || EMAIL_CONTENT.login_2fa)(code);
        attempts.push(
            sendMail({ to: email, subject, text })
                .then((r) => ({ channel: 'email', ok: true, stub: !!r?.stub }))
                .catch((error) => ({ channel: 'email', ok: false, error })),
        );
    }

    if (attempts.length === 0) {
        throw new Error('No delivery channel (mobile number or email) is on file for this account.');
    }

    const results = await Promise.all(attempts);
    results.forEach((r) => r.error && console.error(`OTP ${r.channel} delivery failed:`, r.error.message));

    // OK if a real provider accepted it, OR if every channel we tried is a
    // console stub (local dev with no gateway wired up). A real send that throws
    // must NOT be masked by the SMS console stub "succeeding".
    const realSuccess = results.some((r) => r.ok && !r.stub);
    const allStubSuccess = results.every((r) => r.ok && r.stub);
    if (!realSuccess && !allStubSuccess) {
        const err = new Error('Could not send your verification code. Please try again.');
        err.code = 'DELIVERY_FAILED';
        throw err;
    }
    return results;
}

function generateCode() {
    // 6 digits, zero-padded, uniformly distributed.
    return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function hashCode(code) {
    return crypto.createHash('sha256').update(String(code)).digest('hex');
}

/** "+639171234567" -> "+63•••••4567" */
function maskDestination(value) {
    if (!value) return null;
    const str = String(value);
    if (str.length <= 4) return str;
    const tail = str.slice(-4);
    const headLen = str.startsWith('+') ? 3 : 2;
    const head = str.slice(0, headLen);
    return `${head}${'•'.repeat(Math.max(3, str.length - headLen - 4))}${tail}`;
}

/** "juan.delacruz@acme.com" -> "ju••••••••••@acme.com" */
function maskEmail(value) {
    if (!value) return null;
    const [user, domain] = String(value).split('@');
    if (!domain) return maskDestination(value);
    const head = user.length <= 2 ? user.slice(0, 1) : user.slice(0, 2);
    return `${head}${'•'.repeat(Math.max(3, user.length - head.length))}@${domain}`;
}

/**
 * Issue a fresh code: invalidates any live code for the same employee+purpose,
 * stores the hash, and delivers the plaintext over every channel supplied
 * (`phone` via SMS and/or `email`). At least one of `phone` / `email` is required.
 *
 * @returns {Promise<{ code: string, destination: string, maskedPhone: ?string,
 *                      maskedEmail: ?string, channels: string[], expiresAt: string,
 *                      resend: boolean }>}
 *          `code` is the plaintext — only surface it to clients outside production.
 * @throws  {Error} with `.code = 'COOLDOWN'` when called again too soon,
 *          or `.code = 'DELIVERY_FAILED'` when no channel could be reached.
 */
async function issueOtp({ employeeId, purpose, phone, email, trx }) {
    const recent = await OtpCode.query(trx)
        .where({ employee_id: employeeId, purpose })
        .whereNull('consumed_at')
        .orderBy('created_at', 'desc')
        .first();

    if (recent) {
        const ageSeconds = (Date.now() - new Date(recent.created_at).getTime()) / 1000;
        if (ageSeconds < RESEND_COOLDOWN_SECONDS) {
            const err = new Error('Please wait a moment before requesting another code.');
            err.code = 'COOLDOWN';
            err.retryAfter = Math.ceil(RESEND_COOLDOWN_SECONDS - ageSeconds);
            throw err;
        }
    }

    // Retire every outstanding code for this purpose so only the newest is valid.
    await OtpCode.query(trx)
        .patch({ consumed_at: new Date().toISOString() })
        .where({ employee_id: employeeId, purpose })
        .whereNull('consumed_at');

    const code = generateCode();
    const maskedPhone = maskDestination(phone);
    const maskedEmail = maskEmail(email);
    // Primary display destination — phone first (keeps the existing `maskedPhone`
    // contract), else the email.
    const destination = maskedPhone || maskedEmail;
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();

    await OtpCode.query(trx).insert({
        employee_id: employeeId,
        purpose,
        code_hash: hashCode(code),
        destination,
        attempts: 0,
        max_attempts: MAX_ATTEMPTS,
        expires_at: expiresAt,
    });

    const delivered = await deliverCode({ purpose, code, phone, email });

    return {
        code,
        destination,
        maskedPhone,
        maskedEmail,
        channels: delivered.filter((r) => r.ok).map((r) => r.channel),
        expiresAt,
        resend: !!recent,
    };
}

/**
 * Check a submitted code. Consumes the row on success; counts the attempt on failure.
 *
 * @returns {Promise<{ ok: boolean, otpId?: number, reason?: string }>}
 */
async function verifyOtp({ employeeId, purpose, code, trx }) {
    const row = await OtpCode.query(trx)
        .where({ employee_id: employeeId, purpose })
        .whereNull('consumed_at')
        .orderBy('created_at', 'desc')
        .first();

    if (!row) return { ok: false, reason: 'No active code. Request a new one.' };
    if (row.isExpired) return { ok: false, reason: 'That code has expired. Request a new one.' };
    if (row.isLocked) return { ok: false, reason: 'Too many attempts. Request a new code.' };

    if (row.code_hash !== hashCode(code)) {
        await OtpCode.query(trx).findById(row.id).patch({ attempts: row.attempts + 1 });
        const left = row.max_attempts - (row.attempts + 1);
        return {
            ok: false,
            reason: left > 0
                ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.`
                : 'Too many attempts. Request a new code.',
        };
    }

    await OtpCode.query(trx).findById(row.id).patch({ consumed_at: new Date().toISOString() });
    return { ok: true, otpId: row.id };
}

module.exports = {
    issueOtp,
    verifyOtp,
    hashCode,
    maskDestination,
    maskEmail,
    CODE_TTL_MINUTES,
    RESEND_COOLDOWN_SECONDS,
};
