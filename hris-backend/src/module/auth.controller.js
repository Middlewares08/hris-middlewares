// src/auth/auth.controller.js
const Credential = require('../database/models/employee/Credential');
const jwt = require('jsonwebtoken'); // Ensure you have jsonwebtoken installed
const Employee = require('../database/models/employee/Employee');

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        // Find the credentials row matching the email
        const credentials = await Credential.query().findOne({ email });
        
        if (!credentials) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Verify the plain text password against the hashed password in the DB
        const isPasswordValid = await credentials.verifyPassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // 💡 Generation step for an OTP token if you use 2FA, 
        // or generate a temporary signing token to pass to the next route step
        const tempToken = jwt.sign(
            { credentialId: credentials.id, email: credentials.email },
            process.env.JWT_TEMP_SECRET || 'temp_secret',
            { expiresIn: '5m' }
        );

        return res.status(200).json({
            message: 'Password verified. Please verify OTP to continue.',
            token: tempToken
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

const verifyOtp = async (req, res) => {
    try {
        const { token, otp, email } = req.body;

        // Validate incoming payload parameters
        if (!token || !otp || !email) { 
            return res.status(400).json({ message: 'Token, email, and OTP code are required.' });
        }

        // --- PLACE YOUR OTP/TOKEN VALIDATION LOGIC HERE ---
        // e.g., const isValid = verifyOtpService(email, token, code);
        // --------------------------------------------------

        // 2. Query database for the user details with their relations eager-loaded
        // We look up by the email matching the related credentials record
        const user = await Employee.query()
            .joinRelated('credentials')
            .where('credentials.email', email)
            .select(
                'employee.employees.id',
                'employee.employees.first_name',
                'employee.employees.last_name',
                'employee.employees.preferred_name'
            )
            .withGraphFetched('[contact, demographics]') // Pulls secondary records cleanly
            .first();

        // Guard clause if user doesn't exist
        if (!user) {
            return res.status(404).json({ message: 'User account not found.' });
        }

        // 3. Generate production access and refresh tokens using the found user's ID
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

        // 4. Set the refresh token securely in an HTTP-only cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Return both the authorization string AND your user object payload
        return res.status(200).json({ 
            accessToken,
            user: {
                id: user.id,
                // firstName: user.first_name,
                // lastName: user.last_name,
                fullName: user.first_name + ' ' + user.last_name,
                // preferredName: user.preferred_name,
                email: email,
                // contact: user.contact || null,
                // demographics: user.demographics || null
            }
        });

    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired OTP token.', error: error.message });
    }
};


const refresh = async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({ message: 'Refresh token missing.' });
        }

        // Verify refresh token and issue a fresh 15-minute access token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh');
        const newAccessToken = jwt.sign({ userId: decoded.userId }, process.env.JWT_ACCESS_SECRET || 'access', { expiresIn: '15m' });

        return res.status(200).json({ accessToken: newAccessToken });
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired refresh token.' });
    }
};

module.exports = {
    login,
    verifyOtp,
    refresh
};