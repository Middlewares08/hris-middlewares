// src/auth/auth.controller.js
const Credential = require('../../database/models/employee/Credential');
const jwt = require('jsonwebtoken'); // Ensure you have jsonwebtoken installed
const Employee = require('../../database/models/employee/Employee');
const Address = require('../../database/models/employee/Address');
const GovernmentDetail = require('../../database/models/employee/GovernmentDetail');
const EmployeeCompensation = require('../../database/models/payroll/EmployeeCompensation');
const Permission = require('../../database/models/roles-and-permission/Permission');
const WorkSchedule = require('../../database/models/attendance/WorkSchedule');
const EmployeeScheduleAssignment = require('../../database/models/attendance/EmployeeScheduleAssignment');
const Holiday = require('../../database/models/attendance/Holiday');
const { resolveSchedule, holidayOn } = require('../../utils/workSchedule');
const { issueOtp, verifyOtp: verifyOtpCode } = require('../../utils/otp');
const { logActivity } = require('../../utils/activityLogger');

// crypto.js loads its key at require-time; guard so a missing key can never crash a route.
let cryptoUtil = null;
try { cryptoUtil = require('../../utils/crypto'); } catch (_) { cryptoUtil = null; }
const encryptSecret = (v) => {
    const s = v === undefined || v === null ? '' : String(v).trim();
    if (!s) return null;
    try { return cryptoUtil ? cryptoUtil.encrypt(s) : s; } catch (_) { return s; }
};
const decryptSecret = (v) => {
    if (!v) return null;
    try { return cryptoUtil ? cryptoUtil.decrypt(String(v)) : String(v); } catch (_) { return null; }
};
const maskAccount = (plain) => {
    if (!plain) return null;
    const s = String(plain);
    return s.length <= 4 ? '••••' : `••••${s.slice(-4)}`;
};

const TEMP_SECRET = process.env.JWT_TEMP_SECRET || 'temp_secret';
const RESET_SECRET = process.env.JWT_RESET_SECRET || 'reset_secret';

// No SMS gateway is wired up yet — outside production, hand the freshly issued
// code straight back to the client so the flow is testable. Never in production.
const isProd = process.env.NODE_ENV === 'production';
const withDevCode = (payload, code) => (isProd ? payload : { ...payload, devCode: code });

// Email is stored verbatim (mixed case) by employee creation, so every auth
// lookup matches case-insensitively.
const findCredentialByEmail = (email) =>
    Credential.query().whereRaw('LOWER(email) = LOWER(?)', [String(email || '').trim()]).first();

const sameEmail = (a, b) =>
    String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// Compare two phone numbers loosely — same trailing 10 digits counts as a match,
// so "+63 917 123 4567", "0917-123-4567" and "639171234567" are equivalent.
const phoneMatches = (a, b) => {
    const digits = (v) => String(v || '').replace(/\D/g, '');
    const da = digits(a);
    const db = digits(b);
    if (!da || !db) return false;
    return da.slice(-10) === db.slice(-10);
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const credentials = await findCredentialByEmail(email);
        if (!credentials) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const isPasswordValid = await credentials.verifyPassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Look up the destinations the second factor can be delivered to.
        const employee = await Employee.query()
            .findById(credentials.employee_id)
            .withGraphFetched('contact');

        const phone = employee?.contact?.personal_phone;
        const otpEmail = credentials.email || employee?.contact?.personal_email;
        if (!phone && !otpEmail) {
            return res.status(409).json({
                message: 'No mobile number or email is on file for this account. Contact HR to enable sign-in.',
            });
        }

        try {
            const { destination, maskedEmail, channels, code } = await issueOtp({
                employeeId: credentials.employee_id,
                purpose: 'login_2fa',
                phone,
                email: otpEmail,
            });

            const tempToken = jwt.sign(
                { credentialId: credentials.id, employeeId: credentials.employee_id, email: credentials.email, purpose: 'login_2fa' },
                TEMP_SECRET,
                { expiresIn: '10m' }
            );

            return res.status(200).json(withDevCode({
                message: 'Password verified. Enter the code we sent you to continue.',
                token: tempToken,
                maskedPhone: destination,
                maskedEmail,
                channels,
            }, code));
        } catch (smsError) {
            if (smsError.code === 'COOLDOWN') {
                return res.status(429).json({ message: smsError.message, retryAfter: smsError.retryAfter });
            }
            console.error('login OTP dispatch failed:', smsError);
            return res.status(502).json({ message: 'Could not send your verification code. Please try again.' });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

const verifyOtp = async (req, res) => {
    try {
        const { token, otp, email } = req.body;

        if (!token || !otp || !email) {
            return res.status(400).json({ message: 'Token, email, and OTP code are required.' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, TEMP_SECRET);
        } catch {
            return res.status(401).json({ message: 'Your session expired. Please sign in again.' });
        }

        if (decoded.purpose !== 'login_2fa' || !sameEmail(decoded.email, email)) {
            return res.status(401).json({ message: 'Your session expired. Please sign in again.' });
        }

        const check = await verifyOtpCode({
            employeeId: decoded.employeeId,
            purpose: 'login_2fa',
            code: otp,
        });
        if (!check.ok) {
            return res.status(401).json({ message: check.reason });
        }

        // Query database for the user details with their relations eager-loaded
        const user = await Employee.query()
            .findById(decoded.employeeId)
            .select(
                'employee.employees.id',
                'employee.employees.first_name',
                'employee.employees.last_name',
                'employee.employees.preferred_name'
            )
            .withGraphFetched('[contact, demographics, position.[department]]');

        if (!user) {
            return res.status(404).json({ message: 'User account not found.' });
        }

        const permissionsList = await Permission.getPermissionsById(user?.id);

        const accessToken = jwt.sign(
            { userId: user.id },
            process.env.JWT_ACCESS_SECRET || 'access',
            { expiresIn: '15m' }
        );
        const refreshToken = jwt.sign(
            { userId: user.id },
            process.env.JWT_REFRESH_SECRET || 'refresh',
            { expiresIn: '7d' }
        );

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        return res.status(200).json({
            accessToken,
            user: {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                fullName: user.first_name + ' ' + user.last_name,
                email: decoded.email || email,
                employeeId: user?.employee_id,
                position: user?.position,
                permissions: permissionsList,
            },
        });
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired OTP token.', error: error.message });
    }
};

/**
 * Resend the current second-factor code for an in-flight login.
 * Body: { token }  (the temp token from /auth/login)
 */
const resendOtp = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ message: 'Token is required.' });

        let decoded;
        try {
            decoded = jwt.verify(token, TEMP_SECRET);
        } catch {
            return res.status(401).json({ message: 'Your session expired. Please sign in again.' });
        }
        if (decoded.purpose !== 'login_2fa') {
            return res.status(401).json({ message: 'Your session expired. Please sign in again.' });
        }

        const employee = await Employee.query()
            .findById(decoded.employeeId)
            .withGraphFetched('contact');
        const phone = employee?.contact?.personal_phone;
        const otpEmail = decoded.email || employee?.contact?.personal_email;
        if (!phone && !otpEmail) {
            return res.status(409).json({ message: 'No mobile number or email is on file for this account.' });
        }

        try {
            const { destination, maskedEmail, channels, code } = await issueOtp({
                employeeId: decoded.employeeId,
                purpose: 'login_2fa',
                phone,
                email: otpEmail,
            });
            return res.status(200).json(withDevCode({
                message: 'A new code is on its way.',
                maskedPhone: destination,
                maskedEmail,
                channels,
            }, code));
        } catch (smsError) {
            if (smsError.code === 'COOLDOWN') {
                return res.status(429).json({ message: smsError.message, retryAfter: smsError.retryAfter });
            }
            console.error('resend OTP failed:', smsError);
            return res.status(502).json({ message: 'Could not send your verification code. Please try again.' });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Step 1 of "forgot password" — verify email + phone belong to the same account,
 * then text a reset code.
 * Body: { email, phone }
 */
const forgotPassword = async (req, res) => {
    try {
        const { email, phone } = req.body;
        if (!email || !phone) {
            return res.status(400).json({ message: 'Email and mobile number are required.' });
        }

        const credentials = await findCredentialByEmail(email);
        let employee = null;
        if (credentials) {
            employee = await Employee.query()
                .findById(credentials.employee_id)
                .withGraphFetched('contact');
        }

        const onFile = employee?.contact?.personal_phone;
        const matched = !!onFile && phoneMatches(onFile, phone);

        if (!matched) {
            // Deliberately vague — do not confirm which half was wrong.
            return res.status(404).json({ message: "That email and mobile number don't match an account." });
        }

        try {
            const { destination, maskedEmail, channels, code } = await issueOtp({
                employeeId: credentials.employee_id,
                purpose: 'password_reset',
                phone: onFile,
                email: credentials.email,
            });

            const token = jwt.sign(
                { employeeId: credentials.employee_id, email: credentials.email, purpose: 'password_reset' },
                TEMP_SECRET,
                { expiresIn: '10m' }
            );

            return res.status(200).json(withDevCode({
                message: 'We sent a reset code to your registered contact details.',
                token,
                maskedPhone: destination,
                maskedEmail,
                channels,
            }, code));
        } catch (smsError) {
            if (smsError.code === 'COOLDOWN') {
                return res.status(429).json({ message: smsError.message, retryAfter: smsError.retryAfter });
            }
            console.error('reset OTP dispatch failed:', smsError);
            return res.status(502).json({ message: 'Could not send your reset code. Please try again.' });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Step 2 of "forgot password" — check the reset code, hand back a one-time
 * reset token that authorises the password change.
 * Body: { token, otp }
 */
const verifyResetOtp = async (req, res) => {
    try {
        const { token, otp } = req.body;
        if (!token || !otp) {
            return res.status(400).json({ message: 'Token and code are required.' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, TEMP_SECRET);
        } catch {
            return res.status(401).json({ message: 'Your reset session expired. Start over.' });
        }
        if (decoded.purpose !== 'password_reset') {
            return res.status(401).json({ message: 'Your reset session expired. Start over.' });
        }

        const check = await verifyOtpCode({
            employeeId: decoded.employeeId,
            purpose: 'password_reset',
            code: otp,
        });
        if (!check.ok) {
            return res.status(401).json({ message: check.reason });
        }

        const resetToken = jwt.sign(
            { employeeId: decoded.employeeId, otpId: check.otpId, purpose: 'password_reset_confirmed' },
            RESET_SECRET,
            { expiresIn: '10m' }
        );

        return res.status(200).json({ message: 'Code verified. Choose a new password.', resetToken });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Step 3 of "forgot password" — set the new password.
 * Body: { token (resetToken), password }
 */
const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return res.status(400).json({ message: 'Reset token and new password are required.' });
        }
        if (String(password).length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters.' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, RESET_SECRET);
        } catch {
            return res.status(401).json({ message: 'Your reset session expired. Start over.' });
        }
        if (decoded.purpose !== 'password_reset_confirmed') {
            return res.status(401).json({ message: 'Your reset session expired. Start over.' });
        }

        const credential = await Credential.query().findOne({ employee_id: decoded.employeeId });
        if (!credential) {
            return res.status(404).json({ message: 'Account not found.' });
        }

        // Instance patch so Credential.$beforeUpdate sees opt.old and re-hashes.
        await credential.$query().patch({ password_hash: password });

        await logActivity({
            employeeId: decoded.employeeId,
            action: 'auth.password_reset',
            category: 'profile',
            description: 'Password reset via SMS verification.',
            req,
        });

        return res.status(200).json({ message: 'Password updated. You can now sign in.' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

const refresh = async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({ message: 'Refresh token missing.' });
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh');
        const newAccessToken = jwt.sign({ userId: decoded.userId }, process.env.JWT_ACCESS_SECRET || 'access', { expiresIn: '15m' });

        return res.status(200).json({ accessToken: newAccessToken });
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired refresh token.' });
    }
};

const getCurrentProfile = async (req, res) => {
    try {
        const user = await Employee.query()
            .findById(req.user.id)
            .withGraphFetched('[contact, demographics, credentials, position.[department]]');

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const permissions = await Permission.getPermissionsById(user.id);

        return res.status(200).json({
            fullName: user.first_name + ' ' + user.last_name,
            employeeId: user?.employee_id,
            firstName: user.first_name,
            lastName: user.last_name,
            preferredName: user.preferred_name,
            email: user.credentials.email,
            position: user?.position,
            permissions,
        });
    } catch (error) {
        return res.status(500).json({ message: 'Error retrieving profile context.', err: error });
    }
};

/* ------------------------------------------------------------------ *
 * EMPLOYEE SELF-SERVICE PROFILE
 *
 * An employee may edit their own contact details, emergency contact,
 * home address and preferred name. Everything else — legal name,
 * position, pay, employment type, date of birth — stays HR-controlled
 * through the admin employee module.
 * ------------------------------------------------------------------ */

const EDITABLE_CONTACT_FIELDS = [
    'personal_email',
    'personal_phone',
    'emergency_contact_name',
    'emergency_contact_relationship',
    'emergency_contact_phone',
];
const EDITABLE_ADDRESS_FIELDS = ['street_address', 'barangay', 'city', 'state_province', 'region', 'postal_code'];

// Keep only the whitelisted keys whose value was actually sent (not undefined).
const pickDefined = (body, keys) =>
    keys.reduce((acc, key) => {
        if (body[key] !== undefined) acc[key] = body[key] === null ? null : String(body[key]).trim();
        return acc;
    }, {});

const getProfile = async (req, res) => {
    try {
        const employee = await Employee.query()
            .findById(req.user.id)
            .withGraphFetched('[contact, demographics, addresses, credentials, position.[department]]');

        if (!employee) {
            return res.status(404).json({ success: false, message: 'Profile not found.' });
        }

        const address = (employee.addresses || [])[0] || {};
        const contact = employee.contact || {};

        return res.status(200).json({
            success: true,
            data: {
                // Read-only identity block (HR-controlled)
                firstName: employee.first_name,
                middleName: employee.middle_name,
                lastName: employee.last_name,
                loginEmail: employee.credentials?.email || null,
                position: employee.position?.name || null,
                department: employee.position?.department?.name || null,
                dateOfBirth: employee.demographics?.date_of_birth || null,
                gender: employee.demographics?.gender || null,
                nationality: employee.demographics?.nationality || null,
                // Editable block
                preferredName: employee.preferred_name || '',
                contact: EDITABLE_CONTACT_FIELDS.reduce((acc, k) => ({ ...acc, [k]: contact[k] || '' }), {}),
                address: EDITABLE_ADDRESS_FIELDS.reduce((acc, k) => ({ ...acc, [k]: address[k] || '' }), {}),
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error retrieving profile.', err: error });
    }
};

const updateProfile = async (req, res) => {
    try {
        const body = req.body || {};

        if (
            body.personal_email !== undefined &&
            body.personal_email !== '' &&
            body.personal_email !== null &&
            !/^\S+@\S+\.\S+$/.test(String(body.personal_email))
        ) {
            return res.status(400).json({ success: false, message: 'personal_email must be a valid email address.' });
        }

        const employee = await Employee.query()
            .findById(req.user.id)
            .withGraphFetched('[contact, addresses]');

        if (!employee) {
            return res.status(404).json({ success: false, message: 'Profile not found.' });
        }

        const ctx = { user: req.user };
        const contactPatch = pickDefined(body, EDITABLE_CONTACT_FIELDS);
        const addressPatch = pickDefined(body, EDITABLE_ADDRESS_FIELDS);
        const employeePatch = pickDefined(body, ['preferred_name']);

        await Employee.transaction(async (trx) => {
            if (Object.keys(employeePatch).length) {
                await Employee.query(trx).where({ id: employee.id }).patch(employeePatch).context(ctx);
            }

            if (Object.keys(contactPatch).length) {
                if (employee.contact) {
                    await employee.$relatedQuery('contact', trx).context(ctx).patch(contactPatch);
                } else {
                    await employee.$relatedQuery('contact', trx).context(ctx).insert(contactPatch);
                }
            }

            if (Object.keys(addressPatch).length) {
                const existing = (employee.addresses || [])[0];
                if (existing) {
                    await Address.query(trx).where({ id: existing.id }).patch(addressPatch).context(ctx);
                } else {
                    await employee.$relatedQuery('addresses', trx).context(ctx).insert(addressPatch);
                }
            }
        });

        await logActivity({
            employeeId: parseInt(req.user.id, 10),
            action: 'profile.self_updated',
            category: 'profile',
            description: 'Updated personal profile details',
            req,
        });

        return res.status(200).json({ success: true, message: 'Profile updated.' });
    } catch (error) {
        if (error?.nativeError?.code === '23505' || error?.code === '23505') {
            return res.status(409).json({ success: false, message: 'That email address is already in use.' });
        }
        return res.status(500).json({ success: false, message: error.message });
    }
};

/* ------------------------------------------------------------------ *
 * EMPLOYEE PREFERENCES (user settings)
 *
 * A single jsonb bag on the employee row. Shape is whitelisted + defaulted
 * here, so unknown keys sent by a client are ignored and missing keys read
 * back as their default. Notification delivery itself is not wired yet —
 * these opt-ins are the stored source of truth for when it is.
 * ------------------------------------------------------------------ */

const PREFERENCE_REGISTRY = {
    notify_announcements: { type: 'boolean', default: true },
    notify_leave_updates: { type: 'boolean', default: true },
    notify_payslip_released: { type: 'boolean', default: true },
    notify_document_updates: { type: 'boolean', default: true },
    notification_channel: { type: 'enum', default: 'email', values: ['email', 'sms', 'both', 'none'] },
    reduce_motion: { type: 'boolean', default: false },
};

// Merge stored values over the registry defaults, keeping only known keys.
const withPreferenceDefaults = (stored) =>
    Object.fromEntries(
        Object.entries(PREFERENCE_REGISTRY).map(([key, meta]) => [
            key,
            stored && key in stored ? stored[key] : meta.default,
        ]),
    );

const getPreferences = async (req, res) => {
    try {
        const employee = await Employee.query().findById(req.user.id).select('preferences');
        if (!employee) return res.status(404).json({ success: false, message: 'Profile not found.' });
        return res.status(200).json({ success: true, data: withPreferenceDefaults(employee.preferences) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const updatePreferences = async (req, res) => {
    try {
        const body = req.body || {};

        const employee = await Employee.query().findById(req.user.id).select('id', 'preferences');
        if (!employee) return res.status(404).json({ success: false, message: 'Profile not found.' });

        const merged = withPreferenceDefaults(employee.preferences);

        for (const [key, meta] of Object.entries(PREFERENCE_REGISTRY)) {
            if (!(key in body)) continue;
            let value = body[key];

            if (meta.type === 'boolean') {
                if (typeof value === 'string') value = value === 'true';
                if (typeof value !== 'boolean') {
                    return res.status(400).json({ success: false, message: `${key} must be true or false.` });
                }
            } else if (meta.type === 'enum' && !meta.values.includes(value)) {
                return res.status(400).json({ success: false, message: `${key} must be one of: ${meta.values.join(', ')}` });
            }

            merged[key] = value;
        }

        await Employee.query().where({ id: employee.id }).patch({ preferences: merged }).context({ user: req.user });

        await logActivity({
            employeeId: parseInt(req.user.id, 10),
            action: 'profile.preferences_updated',
            category: 'profile',
            description: 'Updated notification preferences',
            req,
        });

        return res.status(200).json({ success: true, data: merged, message: 'Preferences saved.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/* ------------------------------------------------------------------ *
 * EMPLOYEE SELF-SERVICE — STATUTORY IDs + PAYROLL BANK ACCOUNT
 *
 * An employee may maintain their own government identifiers (SSS, PhilHealth,
 * Pag-IBIG, TIN) and the bank account their pay is deposited to. The
 * contribution-exempt flags stay HR-controlled through the admin module.
 * ------------------------------------------------------------------ */

const GOV_FIELDS = ['tin_number', 'sss_number', 'philhealth_number', 'pagibig_number'];
const BANK_FIELDS = ['bank_name', 'bank_account_name', 'bank_account_number'];

// digits(value).length must equal one of these, per ID type. Empty = allowed (clear).
const GOV_DIGIT_LENGTHS = {
    sss_number: [10],
    tin_number: [9, 12],
    philhealth_number: [12],
    pagibig_number: [12],
};
const GOV_LABELS = {
    sss_number: 'SSS number',
    tin_number: 'TIN',
    philhealth_number: 'PhilHealth number',
    pagibig_number: 'Pag-IBIG number',
};

const today = () => new Date().toISOString().substring(0, 10);

const getStatutory = async (req, res) => {
    try {
        const employee = await Employee.query()
            .findById(req.user.id)
            .withGraphFetched('governmentDetails');

        if (!employee) {
            return res.status(404).json({ success: false, message: 'Profile not found.' });
        }

        const gov = employee.governmentDetails || {};
        const comp = await EmployeeCompensation.activeForEmployee(req.user.id, today());
        const bankNumber = comp ? decryptSecret(comp.bank_account_number) : null;

        return res.status(200).json({
            success: true,
            data: {
                government: {
                    ...GOV_FIELDS.reduce((acc, k) => ({ ...acc, [k]: gov[k] || '' }), {}),
                    is_sss_exempt: !!gov.is_sss_exempt,
                    is_philhealth_exempt: !!gov.is_philhealth_exempt,
                    is_pagibig_exempt: !!gov.is_pagibig_exempt,
                },
                bank: {
                    bank_name: comp?.bank_name || '',
                    bank_account_name: comp?.bank_account_name || '',
                    bank_account_number: bankNumber || '',
                    bank_account_last4: maskAccount(bankNumber),
                    has_pay_profile: !!comp,
                },
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error retrieving statutory details.', err: error });
    }
};

const updateStatutory = async (req, res) => {
    try {
        const body = req.body || {};

        // Whitelist + trim; strip formatting from the government numbers.
        const govPatch = {};
        for (const key of GOV_FIELDS) {
            if (body[key] === undefined) continue;
            const raw = body[key] === null ? '' : String(body[key]).trim();
            const digits = raw.replace(/\D/g, '');
            if (digits && !GOV_DIGIT_LENGTHS[key].includes(digits.length)) {
                return res.status(400).json({
                    success: false,
                    message: `Enter a valid ${GOV_LABELS[key]}.`,
                });
            }
            govPatch[key] = raw || null;
        }

        const bankPatch = {};
        for (const key of BANK_FIELDS) {
            if (body[key] === undefined) continue;
            const val = body[key] === null ? '' : String(body[key]).trim();
            bankPatch[key] = key === 'bank_account_number' ? encryptSecret(val) : (val || null);
        }

        if (!Object.keys(govPatch).length && !Object.keys(bankPatch).length) {
            return res.status(400).json({ success: false, message: 'No editable fields were provided.' });
        }

        const employee = await Employee.query()
            .findById(req.user.id)
            .withGraphFetched('governmentDetails');
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Profile not found.' });
        }

        const ctx = { user: req.user };

        await Employee.transaction(async (trx) => {
            if (Object.keys(govPatch).length) {
                if (employee.governmentDetails) {
                    await employee.$relatedQuery('governmentDetails', trx).context(ctx).patch(govPatch);
                } else {
                    await employee.$relatedQuery('governmentDetails', trx).context(ctx).insert(govPatch);
                }
            }

            if (Object.keys(bankPatch).length) {
                const comp = await EmployeeCompensation.activeForEmployee(req.user.id, today(), trx);
                if (!comp) {
                    const err = new Error('No pay profile on file yet. Contact HR/Payroll to set one up.');
                    err.status = 409;
                    throw err;
                }
                await EmployeeCompensation.query(trx).findById(comp.id).patch(bankPatch).context(ctx);
            }
        });

        await logActivity({
            employeeId: parseInt(req.user.id, 10),
            action: 'profile.statutory_updated',
            category: 'profile',
            description: 'Updated statutory / bank details',
            req,
        });

        return res.status(200).json({ success: true, message: 'Details updated.' });
    } catch (error) {
        if (error?.status === 409) {
            return res.status(409).json({ success: false, message: error.message });
        }
        if (error?.nativeError?.code === '23505' || error?.code === '23505') {
            return res.status(409).json({ success: false, message: 'One of the government numbers is already registered.' });
        }
        return res.status(500).json({ success: false, message: error.message });
    }
};

/* ------------------------------------------------------------------ *
 * EMPLOYEE SELF-SERVICE — EMPLOYMENT HISTORY (read-only)
 *
 * Nothing new is stored: this is assembled from the employee row (hire date,
 * employment type, generated employee_id), the current position/department,
 * and the effective-dated rows already kept in payroll.employee_compensations.
 * ------------------------------------------------------------------ */

const getEmploymentHistory = async (req, res) => {
    try {
        const employee = await Employee.query()
            .findById(req.user.id)
            .select('employee.employees.id', 'employee.employees.employee_id', 'employee.employees.date_hired', 'employee.employees.employment_type')
            .withGraphFetched('position.[department]');

        if (!employee) {
            return res.status(404).json({ success: false, message: 'Profile not found.' });
        }

        const rows = await EmployeeCompensation.query()
            .where({ employee_id: req.user.id, is_deleted: false })
            .orderBy('effective_date', 'desc');

        return res.status(200).json({
            success: true,
            data: {
                employeeId: employee.employee_id || null,
                dateHired: employee.date_hired || null,
                employmentType: employee.employment_type || null,
                position: employee.position?.name || null,
                department: employee.position?.department?.name || null,
                payHistory: rows.map((r) => ({
                    effective_date: r.effective_date,
                    end_date: r.end_date,
                    rate_type: r.rate_type,
                    pay_rate: r.pay_rate,
                    monthly_equivalent: r.monthly_equivalent,
                    is_active: !!r.is_active,
                })),
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error retrieving employment history.', err: error });
    }
};

/**
 * The authenticated employee's own work schedule — the weekly pattern plus
 * today's expected shift. Falls back to the org default when unassigned.
 */
const getMySchedule = async (req, res) => {
    try {
        const employeeId = req.user.id;
        const today = new Date();
        const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        const assignment = await EmployeeScheduleAssignment.activeForEmployee(employeeId, todayYmd);
        let schedule = null;
        if (assignment) {
            schedule = await WorkSchedule.query()
                .findById(assignment.schedule_id)
                .where('is_deleted', false)
                .withGraphFetched('days');
        }
        if (!schedule) schedule = await WorkSchedule.defaultSchedule();

        const shift = await resolveSchedule(WorkSchedule.knex(), employeeId, todayYmd);
        const holiday = await holidayOn(WorkSchedule.knex(), todayYmd);

        return res.status(200).json({
            success: true,
            data: {
                assigned: !!assignment,
                effectiveDate: assignment?.effective_date || null,
                schedule: schedule ? {
                    name: schedule.name,
                    description: schedule.description,
                    grace_minutes: schedule.grace_minutes,
                    half_day_hours: schedule.half_day_hours,
                    is_default: !!schedule.is_default,
                    days: (schedule.days || []).map((d) => ({
                        weekday: d.weekday,
                        is_workday: !!d.is_workday,
                        start_time: d.start_time,
                        end_time: d.end_time,
                        break_minutes: d.break_minutes,
                    })),
                } : null,
                today: {
                    date: todayYmd,
                    isWorkday: shift.isWorkday,
                    isRestDay: !shift.isWorkday,
                    isHoliday: !!holiday,
                    holidayName: holiday?.name || null,
                    scheduledStart: shift.scheduledStart ? shift.scheduledStart.toISOString() : null,
                    scheduledEnd: shift.scheduledEnd ? shift.scheduledEnd.toISOString() : null,
                    scheduledHours: shift.scheduledHours,
                    crossesMidnight: shift.crossesMidnight,
                },
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error retrieving your schedule.', err: error });
    }
};

/**
 * Read-only holiday calendar for the employee PWA. `?year=YYYY` (defaults to the
 * current year). Holidays are non-sensitive, so only a valid session is required.
 */
const getMyHolidays = async (req, res) => {
    try {
        const year = /^\d{4}$/.test(String(req.query.year || ''))
            ? req.query.year
            : String(new Date().getFullYear());

        const rows = await Holiday.inRange(Holiday.knex(), `${year}-01-01`, `${year}-12-31`);

        return res.status(200).json({
            success: true,
            data: rows.map((h) => ({
                uuid: h.uuid,
                date: h.date,
                name: h.name,
                type: h.type,
            })),
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error retrieving the holiday calendar.', err: error });
    }
};

module.exports = {
    login,
    verifyOtp,
    resendOtp,
    forgotPassword,
    verifyResetOtp,
    resetPassword,
    refresh,
    getCurrentProfile,
    getProfile,
    updateProfile,
    getPreferences,
    updatePreferences,
    getStatutory,
    updateStatutory,
    getEmploymentHistory,
    getMySchedule,
    getMyHolidays,
};
