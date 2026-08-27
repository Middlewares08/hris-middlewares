// src/middleware/permissionMiddleware.js
const Permission = require('../database/models/roles-and-permission/Permission');

// 🎯 Must run after verifyToken — relies on req.user.id being already set
const requirePermission = (requiredSlug) => {
    return async (req, res, next) => {
        try {
            const employeeId = req.user?.id;

            if (!employeeId) {
                return res.status(401).json({ success: false, message: 'Access denied. No authenticated user context.' });
            }

            const permissions = await Permission.getPermissionsById(employeeId);

            if (!permissions.includes(requiredSlug)) {
                return res.status(403).json({ success: false, message: `Access denied. Missing required permission: ${requiredSlug}` });
            }

            next();
        } catch (error) {
            console.error('Permission check error:', error);
            return res.status(500).json({ success: false, message: 'Server error validating permissions.' });
        }
    };
};

module.exports = { requirePermission };
