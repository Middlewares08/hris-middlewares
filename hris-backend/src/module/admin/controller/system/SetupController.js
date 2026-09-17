// src/module/admin/controller/system/SetupController.js
const EmployerProfile = require('../../../../database/models/payroll/EmployerProfile');
const { completeness } = require('../payroll/EmployerProfileController');
const Setting = require('../../../../database/models/system/Setting');

/**
 * One entry per Setup Wizard checklist item. `check` derives done/pending live
 * from real data — no separate "acknowledged" state to fall out of sync. Add a
 * step here (and a matching page to link to in hris-frontend) to extend the
 * wizard; nothing else needs to change.
 */
const STEPS = [
    {
        key: 'employer-profile',
        title: 'Company profile',
        description: 'Legal name, TIN, address, and SSS/PhilHealth/Pag-IBIG employer IDs — required before payroll can generate government filings.',
        actionPath: '/dashboard/payroll/employer-profile',
        permission: 'employer-profile:edit',
        required: true,
        check: async () => {
            const profile = await EmployerProfile.singleton();
            const json = typeof profile.toJSON === 'function' ? profile.toJSON() : profile;
            return completeness(json).isComplete;
        },
    },
];

/**
 * 🔍 READ — the wizard's on/off switch plus each step's live done/pending state.
 * Drives both the hris-frontend checklist page and its dashboard redirect gate.
 */
const getSetupStatus = async (req, res) => {
    try {
        const wizardEnabled = await Setting.getBool('setup.wizard_enabled', true);
        // Server-controlled only (env flag) — never something the client can turn on.
        // Drives whether the "Start Fresh" danger-zone UI even renders.
        const resetAllowed = process.env.ALLOW_DB_RESET === 'true';

        const steps = await Promise.all(
            STEPS.map(async (step) => ({
                key: step.key,
                title: step.title,
                description: step.description,
                actionPath: step.actionPath,
                permission: step.permission,
                required: step.required,
                done: await step.check(),
            })),
        );

        const completed = steps.every((step) => !step.required || step.done);

        return res.status(200).json({ success: true, data: { wizardEnabled, resetAllowed, completed, steps } });
    } catch (error) {
        console.error('Fetch setup status error:', error);
        return res.status(500).json({ success: false, message: 'Server error retrieving setup status.' });
    }
};

module.exports = { getSetupStatus };
