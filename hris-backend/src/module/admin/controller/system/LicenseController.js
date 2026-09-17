const LicenseActivation = require('../../../../database/models/system/LicenseActivation');

/**
 * 🔍 READ — every install activation, newest first, key masked. Drives the
 * Maintenance > License page. Never exposes the plaintext product key.
 */
const getLicenseActivations = async (_req, res) => {
    try {
        const rows = await LicenseActivation.query().orderBy('id', 'desc');
        return res.status(200).json({ success: true, data: rows.map((row) => row.present()) });
    } catch (error) {
        console.error('Fetch license activations error:', error);
        return res.status(500).json({ success: false, message: 'Server error retrieving license activations.' });
    }
};

module.exports = { getLicenseActivations };
