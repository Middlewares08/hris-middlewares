// src/module/public/license.controller.js
//
// Public, unauthenticated license status + activation. Status lets both
// frontends gate entry (bounce straight to /license-expired before a user
// ever reaches the login screen) instead of only finding out reactively
// after a failed API call. Activation is the recovery path out of that
// screen: unlike /public/install/complete, it never creates an employee, so
// it stays usable on a deployment that already has accounts but lost its
// license (expired, or — same trust model as Install — never had one).
const LicenseActivation = require('../../database/models/system/LicenseActivation');
const { getLicenseState, clearLicenseCache } = require('../../utils/licenseGuard');
const { validateProductKey } = require('../../utils/licenseService');

/** GET /public/license/status — drives both frontends' app-wide license gate. */
const getLicenseStatus = async (_req, res) => {
    const { hasLicense, blocked, expiresAt, licenseType } = await getLicenseState();
    return res.status(200).json({ success: true, data: { hasLicense, expired: blocked, expiresAt, licenseType } });
};

/** POST /public/license/activate — the "add a license" recovery form on /license-expired. */
const activateLicense = async (req, res) => {
    try {
        const state = await getLicenseState();
        if (!state.blocked) {
            return res.status(409).json({ success: false, message: 'A license is already active on this deployment.' });
        }

        const { productKey, email } = req.body || {};
        const licenseCheck = await validateProductKey(productKey);
        if (!licenseCheck.valid) {
            return res.status(400).json({ success: false, message: licenseCheck.reason || 'Invalid product key.' });
        }

        await LicenseActivation.query().insert({
            product_key_hash: productKey,
            sent_to_email: String(email).toLowerCase().trim(),
            is_stub: !!licenseCheck.stub,
            license_type: licenseCheck.licenseType || null,
            expires_at: licenseCheck.expiresAt || null,
            ip_address: req.ip || null,
            sent_at: new Date().toISOString(),
        });

        clearLicenseCache();

        return res.status(201).json({ success: true, message: 'License activated. You can log in now.' });
    } catch (error) {
        console.error('license.activate error:', error);
        return res.status(500).json({ success: false, message: 'Server error activating the license.' });
    }
};

module.exports = { getLicenseStatus, activateLicense };
