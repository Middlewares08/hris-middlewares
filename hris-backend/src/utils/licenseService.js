// src/utils/licenseService.js
//
// Product-key validation for the Install Wizard. Provider-style, deliberately
// mirroring sms.js / mailer.js: a no-op stub until LICENSE_API_URL is set,
// so the install flow works end-to-end today and swaps to real enforcement
// later by setting env vars only — no code changes on either side.
const crypto = require('crypto');

const LICENSE_API_URL = process.env.LICENSE_API_URL;
const LICENSE_API_KEY = process.env.LICENSE_API_KEY;

// Stub-mode default when no real license server is configured yet — lets the
// whole expiration/enforcement flow be testable today. 30-day trial window.
const STUB_TRIAL_DAYS = 30;

// Matches the license server's utils/licenseCrypto.js exactly: AES-256-GCM,
// payload layout iv(12) + authTag(16) + ciphertext, all base64-encoded.
const DECRYPT_ALGORITHM = 'aes-256-gcm';
const DECRYPT_IV_LENGTH = 12;
const DECRYPT_AUTH_TAG_LENGTH = 16;

function decryptPayload(base64Data) {
    const hexKey = process.env.LICENSE_ENCRYPTION_KEY;
    if (!hexKey || hexKey.length !== 64) {
        throw new Error('LICENSE_ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes)');
    }
    const key = Buffer.from(hexKey, 'hex');

    const raw = Buffer.from(base64Data, 'base64');
    const iv = raw.subarray(0, DECRYPT_IV_LENGTH);
    const authTag = raw.subarray(DECRYPT_IV_LENGTH, DECRYPT_IV_LENGTH + DECRYPT_AUTH_TAG_LENGTH);
    const ciphertext = raw.subarray(DECRYPT_IV_LENGTH + DECRYPT_AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(DECRYPT_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return JSON.parse(plaintext.toString('utf8'));
}

/**
 * @param {string} productKey
 * @returns {Promise<{ valid: boolean, reason?: string, stub?: boolean, licenseType?: string, expiresAt?: string|null }>}
 */
async function validateProductKey(productKey) {
    const key = String(productKey || '').trim();
    if (!key) {
        return { valid: false, reason: 'Product key is required.' };
    }

    if (!LICENSE_API_URL) {
        const expiresAt = new Date(Date.now() + STUB_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
        console.warn(`[license] LICENSE_API_URL not set — accepting product key "${key}" unverified (stub mode, ${STUB_TRIAL_DAYS}-day trial).`);
        return { valid: true, stub: true, licenseType: 'Trial', expiresAt };
    }

    try {
        const response = await fetch(LICENSE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': LICENSE_API_KEY,
            },
            body: JSON.stringify({ licenseKey: key }),
        });

        if (!response.ok) {
            return { valid: false, reason: `License server responded with status ${response.status}.` };
        }

        const body = await response.json();
        const payload = decryptPayload(body.data);

        if (!payload.valid) {
            const reasonByStatus = {
                not_found: 'Product key not recognized.',
                expired: 'This license has expired.',
                revoked: 'This license has been revoked.',
            };
            return { valid: false, reason: reasonByStatus[payload.status] || 'This license is not active.' };
        }

        return { valid: true, licenseType: payload.licenseType, expiresAt: payload.expiresAt };
    } catch (error) {
        console.error('[license] validation request failed:', error.message);
        return { valid: false, reason: 'Could not reach the license server. Try again shortly.' };
    }
}

module.exports = { validateProductKey };
