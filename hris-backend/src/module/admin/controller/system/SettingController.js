const Setting = require('../../../../database/models/system/Setting');
const { logActivity } = require('../../../../utils/activityLogger');

const actorId = (req) => (req.user?.id ? parseInt(req.user.id, 10) : null);
const { REGISTRY } = Setting;

/**
 * 🔍 READ — every setting (admin). Returns a flat { key: value } map plus the rows.
 */
const getSettings = async (req, res) => {
    try {
        const rows = await Setting.query().orderBy('key');
        const values = rows.reduce((acc, r) => ({ ...acc, [r.key]: r.value?.value }), {});
        // Surface registry keys that have no row yet, using their defaults.
        for (const [key, meta] of Object.entries(REGISTRY)) {
            if (!(key in values)) values[key] = meta.default;
        }
        return res.status(200).json({ success: true, data: { values, rows } });
    } catch (error) {
        console.error('Fetch settings error:', error);
        return res.status(500).json({ success: false, message: 'Server error retrieving settings.' });
    }
};

/**
 * 📣 READ — public subset for any authenticated employee (drives client feature gating).
 */
const getPublicSettings = async (req, res) => {
    try {
        const rows = await Setting.query().where('is_public', true);
        const values = rows.reduce((acc, r) => ({ ...acc, [r.key]: r.value?.value }), {});
        for (const [key, meta] of Object.entries(REGISTRY)) {
            if (meta.public && !(key in values)) values[key] = meta.default;
        }
        return res.status(200).json({ success: true, data: values });
    } catch (error) {
        console.error('Fetch public settings error:', error);
        return res.status(500).json({ success: false, message: 'Server error retrieving settings.' });
    }
};

/**
 * 🔄 UPDATE — set one known key (admin).
 */
const updateSetting = async (req, res) => {
    try {
        const { key } = req.params;
        const meta = REGISTRY[key];
        if (!meta) {
            return res.status(400).json({ success: false, message: `Unknown setting key: ${key}` });
        }

        let { value } = req.body;
        if (meta.type === 'boolean') {
            if (typeof value === 'string') value = value === 'true';
            if (typeof value !== 'boolean') {
                return res.status(400).json({ success: false, message: `${key} must be a boolean.` });
            }
        }
        if (meta.type === 'number') {
            value = Number(value);
            if (!Number.isFinite(value) || value < 0) {
                return res.status(400).json({ success: false, message: `${key} must be a non-negative number.` });
            }
        }

        const saved = await Setting.set(key, value, actorId(req));

        await logActivity({
            employeeId: actorId(req),
            action: 'system.setting_updated',
            category: 'system',
            description: `Setting "${key}" set to ${JSON.stringify(value)}`,
            metadata: { key, value },
            req,
        });

        return res.status(200).json({ success: true, data: { key, value: saved.value?.value } });
    } catch (error) {
        console.error('Update setting error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getSettings, getPublicSettings, updateSetting };
