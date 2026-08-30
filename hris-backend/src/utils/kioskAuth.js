const crypto = require('crypto');
const KioskDevice = require('../database/models/attendance/KioskDevice');

/* ============================================================
 * Attendance-kiosk device authentication.
 *
 * A registered kiosk sends its bearer token on every /kiosk/* call via the
 * `X-Kiosk-Token` header. Only sha256(token) is stored, so a leaked token is
 * revoked by flipping the device to `status = 'revoked'`.
 * ========================================================== */

/** A fresh random device token (raw — shown to the admin once). */
const generateToken = () => crypto.randomBytes(24).toString('hex'); // 48 hex chars

/** sha256 hex of a raw token, as stored in `kiosk_devices.token_hash`. */
const hashToken = (raw) => crypto.createHash('sha256').update(String(raw)).digest('hex');

/**
 * Express middleware — authenticate the request as a registered, active kiosk.
 * On success sets `req.kiosk = { id, uuid, name }`.
 */
const verifyKioskToken = async (req, res, next) => {
    try {
        const raw = req.headers['x-kiosk-token'];
        if (!raw) {
            return res.status(401).json({ success: false, code: 'KIOSK_UNAUTHORIZED', message: 'Missing kiosk token.' });
        }

        const device = await KioskDevice.query().findOne({
            token_hash: hashToken(raw),
            status: 'active',
            is_deleted: false,
        });
        if (!device) {
            return res.status(401).json({ success: false, code: 'KIOSK_UNAUTHORIZED', message: 'This kiosk device is not active.' });
        }

        req.kiosk = { id: device.id, uuid: device.uuid, name: device.name };

        // Fire-and-forget heartbeat — never block the punch on it.
        KioskDevice.query()
            .findById(device.id)
            .patch({ last_seen_at: new Date().toISOString() })
            .catch((err) => console.error('kiosk last_seen_at update failed:', err.message));

        return next();
    } catch (error) {
        console.error('verifyKioskToken error:', error);
        return res.status(500).json({ success: false, message: 'Kiosk auth check failed.' });
    }
};

module.exports = { generateToken, hashToken, verifyKioskToken };
