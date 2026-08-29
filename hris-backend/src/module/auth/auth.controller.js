// src/auth/auth.controller.js
const Credential = require('../../database/models/employee/Credential');
const jwt = require('jsonwebtoken'); // Ensure you have jsonwebtoken installed
const Employee = require('../../database/models/employee/Employee');
const Permission = require('../../database/models/roles-and-permission/Permission');
const { issueOtp, verifyOtp: verifyOtpCode } = require('../../utils/otp');
const { logActivity } = require('../../utils/activityLogger');

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

        // Look up the mobile number the second factor will be delivered to.
        const employee = await Employee.query()
            .findById(credentials.employee_id)
            .withGraphFetched('contact');

        const phone = employee?.contact?.personal_phone;
        if (!phone) {
            return res.status(409).json({
                message: 'No mobile number is on file for this account. Contact HR to enable sign-in.',
            });
        }

        try {
            const { destination, code } = await issueOtp({
                employeeId: credentials.employee_id,
                purpose: 'login_2fa',
                phone,
            });

            const tempToken = jwt.sign(
                { credentialId: credentials.id, employeeId: credentials.employee_id, email: credentials.email, purpose: 'login_2fa' },
                TEMP_SECRET,
                { expiresIn: '10m' }
            );

            return res.status(200).json(withDevCode({
                message: 'Password verified. Enter the code we texted you to continue.',
                token: tempToken,
                maskedPhone: destination,
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
        if (!phone) {
            return res.status(409).json({ message: 'No mobile number is on file for this account.' });
        }

        try {
            const { destination, code } = await issueOtp({
                employeeId: decoded.employeeId,
                purpose: 'login_2fa',
                phone,
            });
            return res.status(200).json(withDevCode({ message: 'A new code is on its way.', maskedPhone: destination }, code));
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
            const { destination, code } = await issueOtp({
                employeeId: credentials.employee_id,
                purpose: 'password_reset',
                phone: onFile,
            });

            const token = jwt.sign(
                { employeeId: credentials.employee_id, email: credentials.email, purpose: 'password_reset' },
                TEMP_SECRET,
                { expiresIn: '10m' }
            );

            return res.status(200).json(withDevCode({
                message: 'We texted a reset code to your registered number.',
                token,
                maskedPhone: destination,
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

        return res.status(200).json({
            fullName: user.first_name + ' ' + user.last_name,
            firstName: user.first_name,
            lastName: user.last_name,
            preferredName: user.preferred_name,
            email: user.credentials.email,
            position: user?.position,
        });
    } catch (error) {
        return res.status(500).json({ message: 'Error retrieving profile context.', err: error });
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
};
