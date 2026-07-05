// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

/**
 * Middleware to protect routes and verify the incoming JWT Access Token
 */
const verifyToken = (req, res, next) => {
    try {
        // 1. Get the token from the Authorization header (Format: Bearer <token>)
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                message: 'Access denied. No authorization token provided.' 
            });
        }

        const token = authHeader.split(' ')[1];

        // 2. Verify the token using your environment secret key
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'access');

        // 3. Attach the decoded payload (e.g., { userId: X }) to the request object
        req.userId = decoded.userId;

        // 4. Pass control to the next middleware or controller handler
        next();
    } catch (error) {
        // Catch expired or malformed token errors specifically
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Access token has expired.' });
        }
        
        return res.status(401).json({ message: 'Invalid or unauthorized token.' });
    }
};

module.exports = { verifyToken };