// src/module/public/install.controller.js
//
// Public, unauthenticated "first visit" install flow. A fresh deployment has
// zero employees and zero credentials — 00_DefaultAdminSeeder only seeds the
// immutable roles now, not an admin account (see its header comment). This
// controller is the ONLY way the first admin account gets created: product
// key + their email/name in, a first-login link out by email. Every mutating
// endpoint re-checks `install.completed` AND that no employee exists yet, so
// this can never be replayed against a live system to mint a rogue admin.
const jwt = require('jsonwebtoken');
const connection = require('../../database/connection');
const Setting = require('../../database/models/system/Setting');
const LicenseActivation = require('../../database/models/system/LicenseActivation');
const Employee = require('../../database/models/employee/Employee');
const { generateEmployeeId } = require('../admin/controller/employee/EmployeeController');
const { validateProductKey } = require('../../utils/licenseService');
const { sendMail } = require('../../utils/mailer');
const { logActivity } = require('../../utils/activityLogger');

const RESET_SECRET = process.env.JWT_RESET_SECRET || 'reset_secret';
const ADMIN_CONSOLE_URL = process.env.ADMIN_CONSOLE_URL || 'http://localhost:5174';
const isProd = process.env.NODE_ENV === 'production';

/**
 * True once the flag is set. Falls back to checking for any employee at all —
 * a deployment that already existed before this feature shipped never had a
 * chance to set the flag, and must never be shown the install wizard just
 * because of that. Detected once, then persisted so later checks don't need
 * to keep re-deriving it.
 */
const isInstalled = async () => {
    if (await Setting.getBool('install.completed', false)) return true;

    const hasAnyEmployee = (await Employee.query().resultSize()) > 0;
    if (hasAnyEmployee) {
        await Setting.set('install.completed', true, null);
        return true;
    }
    return false;
};

/** GET /public/install/status — drives the frontend's app-wide install gate. */
const getInstallStatus = async (_req, res) => {
    try {
        return res.status(200).json({ success: true, data: { installed: await isInstalled() } });
    } catch (error) {
        console.error('install.status error:', error);
        return res.status(500).json({ success: false, message: 'Server error checking install status.' });
    }
};

/** POST /public/install/validate-key — lets the wizard check the key before step 2. */
const validateKey = async (req, res) => {
    try {
        if (await isInstalled()) {
            return res.status(409).json({ success: false, message: 'This system is already installed.' });
        }

        const result = await validateProductKey(req.body?.productKey);
        return res.status(result.valid ? 200 : 400).json({
            success: result.valid,
            message: result.valid ? 'Product key accepted.' : (result.reason || 'Invalid product key.'),
        });
    } catch (error) {
        console.error('install.validateKey error:', error);
        return res.status(500).json({ success: false, message: 'Server error validating the product key.' });
    }
};

/** POST /public/install/complete — creates the first admin, emails a first-login link. */
const completeInstall = async (req, res) => {
    try {
        if (await isInstalled()) {
            return res.status(409).json({ success: false, message: 'This system is already installed.' });
        }
        // Belt-and-braces alongside the flag above — refuse outright if any
        // account already exists, even if the flag somehow lagged reality.
        const alreadyHasEmployees = await Employee.query().resultSize();
        if (alreadyHasEmployees > 0) {
            return res.status(409).json({ success: false, message: 'This system already has accounts — refusing to install again.' });
        }

        const { productKey, email, firstName, lastName } = req.body || {};
        const missing = ['productKey', 'email', 'firstName', 'lastName'].filter((f) => !req.body?.[f]);
        if (missing.length) {
            return res.status(400).json({ success: false, message: `Missing required field(s): ${missing.join(', ')}` });
        }
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
        }

        const licenseCheck = await validateProductKey(productKey);
        if (!licenseCheck.valid) {
            return res.status(400).json({ success: false, message: licenseCheck.reason || 'Invalid product key.' });
        }

        const adminRole = await connection('role_permission.roles').where({ slug: 'administrator' }).first();
        if (!adminRole) {
            return res.status(500).json({ success: false, message: 'Roles have not been seeded yet — run database migrations/seeders before installing.' });
        }

        const cleanEmail = String(email).toLowerCase().trim();

        const employee = await connection.transaction(async (trx) => {
            const employeeId = await generateEmployeeId(trx, new Date().getFullYear());

            // Mirrors EmployeeController.createEmployee's graphData idiom — Employee's
            // $afterInsert hook inserts these related rows AND auto-relates the default
            // 'User' role for us. No password_hash: Credential.$beforeInsert generates
            // and hashes a random one nobody knows; the emailed link is the only way in.
            const created = await Employee.query(trx)
                .insert({
                    employee_id: employeeId,
                    first_name: String(firstName).trim(),
                    last_name: String(lastName).trim(),
                    preferred_name: String(firstName).trim(),
                    is_active: true,
                })
                .context({
                    graphData: {
                        contact: {
                            personal_email: cleanEmail,
                            personal_phone: '+630000000000',
                            emergency_contact_name: 'System Fallback',
                            emergency_contact_relationship: 'Other',
                            emergency_contact_phone: '+630000000000',
                        },
                        demographics: {
                            date_of_birth: '1970-01-01',
                            gender: 'Prefer not to say',
                            nationality: 'System',
                        },
                        credentials: { email: cleanEmail },
                    },
                });

            await trx('role_permission.employee_roles')
                .insert({ employee_id: created.id, role_id: adminRole.id })
                .onConflict(['employee_id', 'role_id'])
                .ignore();

            return created;
        });

        await Setting.set('install.completed', true, employee.id);

        const resetToken = jwt.sign(
            { employeeId: employee.id, otpId: 'install', purpose: 'password_reset_confirmed' },
            RESET_SECRET,
            { expiresIn: '72h' },
        );
        const link = `${ADMIN_CONSOLE_URL.replace(/\/$/, '')}/reset-password?token=${resetToken}`;

        await sendMail({
            to: cleanEmail,
            subject: 'Set up your HRIS administrator account',
            text: `Welcome! Set your password to finish activating your HRIS administrator account: ${link}\n\nThis link expires in 72 hours.`,
            html: `<p>Welcome! Click below to set your password and finish activating your HRIS administrator account.</p>`
                + `<p><a href="${link}">Set your password</a></p>`
                + `<p style="color:#64748b;font-size:12px;">This link expires in 72 hours.</p>`,
        });

        // Auditable record for Maintenance > License — key masked on every read,
        // never returned in plaintext. `activated_at` stays null until the admin
        // actually clicks through and sets their password (see auth.controller.js
        // resetPassword's markActivated call).
        await LicenseActivation.query().insert({
            product_key_hash: productKey,
            sent_to_email: cleanEmail,
            employee_id: employee.id,
            is_stub: !!licenseCheck.stub,
            license_type: licenseCheck.licenseType || null,
            expires_at: licenseCheck.expiresAt || null,
            ip_address: req.ip || null,
            sent_at: new Date().toISOString(),
        });

        await logActivity({
            employeeId: employee.id,
            action: 'system.install_completed',
            category: 'system',
            description: `System installed — first admin account created for ${cleanEmail}.`,
            req,
        });

        return res.status(201).json({
            success: true,
            message: 'Installation complete. Check your email for a link to set your password.',
            // Non-prod convenience — mirrors the OTP `devCode` / contact-admin `devPreview`
            // convention elsewhere, so this is testable without a real mail provider wired up.
            data: isProd ? undefined : { devPreview: { link } },
        });
    } catch (error) {
        console.error('install.complete error:', error);
        return res.status(500).json({ success: false, message: 'Server error completing installation.' });
    }
};

module.exports = { getInstallStatus, validateKey, completeInstall };
