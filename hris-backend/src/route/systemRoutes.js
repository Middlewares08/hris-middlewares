// src/route/systemRoutes.js
const express = require('express');
const router = express.Router();
const { initializeFirstUser } = require('../module/admin/controller/employee/init.user.controller'); // Double check this relative path matches your directory setup
const { getSettings, getPublicSettings, updateSetting } = require('../module/admin/controller/system/SettingController');
const { verifyToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');

// Register the POST endpoint
router.post('/init', initializeFirstUser);

// APPLICATION SETTINGS / FEATURE FLAGS
// Public subset — any authenticated employee (client feature gating). Declared before '/settings'.
router.get('/settings/public', verifyToken, getPublicSettings);
router.get('/settings', verifyToken, requirePermission('maintenance:view'), getSettings);
router.put('/settings/:key', verifyToken, requirePermission('maintenance:edit'), updateSetting);

module.exports = router;
