const express = require('express');
const router = express.Router();

const {
    getConfig,
    startLiveness,
    punch,
    listDevices,
    createDevice,
    revokeDevice,
    reindexEnrollments,
} = require('../../module/admin/controller/attendance/KioskController');

const { verifyToken } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');
const { verifyKioskToken } = require('../../utils/kioskAuth');
const { singleFile } = require('../../middleware/uploadMiddleware');

// ---- device-authenticated: the kiosk screen (X-Kiosk-Token header) ----
router.get('/config', verifyKioskToken, getConfig);
router.post('/liveness-session', verifyKioskToken, startLiveness);
// `singleFile('image')` parses an optional plain-photo punch (liveness-off mode);
// non-multipart (liveness session) requests pass straight through.
router.post('/punch', verifyKioskToken, singleFile('image'), punch);

// ---- admin-authenticated: kiosk device management ----
router.get('/devices', verifyToken, requirePermission('attendance-kiosk:view'), listDevices);
router.post('/devices', verifyToken, requirePermission('attendance-kiosk:create'), createDevice);
router.delete('/devices/:uuid', verifyToken, requirePermission('attendance-kiosk:delete'), revokeDevice);
router.post('/reindex', verifyToken, requirePermission('attendance-kiosk:edit'), reindexEnrollments);

module.exports = router;
