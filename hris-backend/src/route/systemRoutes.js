// src/route/systemRoutes.js
const express = require('express');
const router = express.Router();
const { getSettings, getPublicSettings, updateSetting } = require('../module/admin/controller/system/SettingController');
const { getSetupStatus } = require('../module/admin/controller/system/SetupController');
const { resetDatabase } = require('../module/admin/controller/system/SystemResetController');
const { getLicenseActivations } = require('../module/admin/controller/system/LicenseController');
const { getHealth } = require('../module/admin/controller/system/SchedulerHealthController');
const { verifyToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');

// APPLICATION SETTINGS / FEATURE FLAGS
// Public subset — any authenticated employee (client feature gating). Declared before '/settings'.
router.get('/settings/public', verifyToken, getPublicSettings);
router.get('/settings', verifyToken, requirePermission('maintenance:view'), getSettings);
router.put('/settings/:key', verifyToken, requirePermission('maintenance:edit'), updateSetting);

// FIRST-TIME SETUP WIZARD — checklist status (see SetupController).
router.get('/setup/status', verifyToken, requirePermission('setup-wizard:view'), getSetupStatus);

// "Start Fresh" — full destructive database reset. Gated by its own `reset`
// action (never implied by `view`) AND the ALLOW_DB_RESET env flag inside the
// controller. See SystemResetController for the full gate chain.
router.post('/setup/reset', verifyToken, requirePermission('setup-wizard:reset'), resetDatabase);

// License activation history — Maintenance dashboard, read-only.
router.get('/license', verifyToken, requirePermission('maintenance:view'), getLicenseActivations);

// Scheduler dead-man's-switch — per-job heartbeat, so "is the worker alive" is
// checkable from the admin UI instead of SSH + `pm2 list`. See scheduler/health.js.
router.get('/scheduler/health', verifyToken, requirePermission('maintenance:view'), getHealth);

module.exports = router;
