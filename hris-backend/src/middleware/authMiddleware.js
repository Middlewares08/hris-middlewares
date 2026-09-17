// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { isLicenseExpired, isHardEnforcementOn } = require('../utils/licenseGuard');

const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                message: 'Access denied. No authorization token provided.'
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'access');

        // 🎯 FIX: Map the payload to match what your controllers expect (req.user.id)
        req.user = {
            id: decoded.userId
        };

        // Real-time kick-out — only when `license.hard_enforcement` is on. In soft
        // mode an already-open session like this one is deliberately left alone;
        // only new logins get refused (see auth.controller.js login()).
        if (await isLicenseExpired() && await isHardEnforcementOn()) {
            return res.status(403).json({ message: 'This license has expired.', code: 'LICENSE_EXPIRED' });
        }

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Access token has expired.' });
        }
        
        return res.status(401).json({ message: 'Invalid or unauthorized token.' });
    }
};

module.exports = { verifyToken };