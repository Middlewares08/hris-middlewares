const crypto = require('crypto');
const OtpCode = require('../database/models/auth/OtpCode');
const { sendSms } = require('./sms');

const CODE_TTL_MINUTES = parseInt(process.env.OTP_TTL_MINUTES || '10', 10);
const MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);
// Smallest gap between two code requests for the same employee+purpose.
const RESEND_COOLDOWN_SECONDS = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '45', 10);

const MESSAGES = {
    login_2fa: (code) => `${code} is your HRIS sign-in code. It expires in ${CODE_TTL_MINUTES} minutes.`,
    password_reset: (code) => `${code} is your HRIS password reset code. It expires in ${CODE_TTL_MINUTES} minutes. If this wasn't you, ignore this message.`,
};

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

/**
 * Issue a fresh code: invalidates any live code for the same employee+purpose,
 * stores the hash, and texts the plaintext to `phone`.
 *
 * @returns {Promise<{ code: string, destination: string, expiresAt: string, resend: boolean }>}
 *          `code` is the plaintext — only surface it to clients outside production.
 * @throws  {Error} with `.code = 'COOLDOWN'` when called again too soon
 */
async function issueOtp({ employeeId, purpose, phone, trx }) {
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
    const masked = maskDestination(phone);
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();

    await OtpCode.query(trx).insert({
        employee_id: employeeId,
        purpose,
        code_hash: hashCode(code),
        destination: masked,
        attempts: 0,
        max_attempts: MAX_ATTEMPTS,
        expires_at: expiresAt,
    });

    await sendSms(phone, (MESSAGES[purpose] || MESSAGES.login_2fa)(code));

    return { code, destination: masked, expiresAt, resend: !!recent };
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
    CODE_TTL_MINUTES,
    RESEND_COOLDOWN_SECONDS,
};
