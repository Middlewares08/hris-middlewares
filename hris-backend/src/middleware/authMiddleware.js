// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
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

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Access token has expired.' });
        }
        
        return res.status(401).json({ message: 'Invalid or unauthorized token.' });
    }
};

module.exports = { verifyToken };