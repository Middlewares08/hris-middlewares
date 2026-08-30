const express = require('express');
const router = express.Router();

const { startSession } = require('../../module/admin/controller/attendance/FaceLivenessController');
const { verifyToken } = require('../../middleware/authMiddleware');

router.use(verifyToken);

// Self-service — any authenticated employee starts their own liveness session.
router.post('/session', startSession);

module.exports = router;
