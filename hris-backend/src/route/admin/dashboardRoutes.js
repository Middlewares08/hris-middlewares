const express = require('express');
const router = express.Router();

const { getAnalytics } = require('../../module/admin/controller/dashboard/DashboardController');

const { verifyToken } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');

// ADMIN — gated by the 'Dashboard' module permission.
router.get('/analytics', verifyToken, requirePermission('dashboard:view'), getAnalytics);

module.exports = router;
