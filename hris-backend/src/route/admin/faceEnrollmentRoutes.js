const express = require('express');
const router = express.Router();

const {
    getMyEnrollment,
    getEnrollment,
    enrollFace,
    removeEnrollment,
} = require('../../module/admin/controller/attendance/FaceEnrollmentController');

const { verifyToken } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');
const { singleFile } = require('../../middleware/uploadMiddleware');

router.use(verifyToken);

// SELF-SERVICE — any authenticated employee. Must precede '/:employee_id'.
router.get('/me', getMyEnrollment);

// Gated by the 'Face Recognition' module permissions
router.get('/:employee_id', requirePermission('face-recognition:view'), getEnrollment);
router.post('/', requirePermission('face-recognition:create'), singleFile('image'), enrollFace);
router.delete('/:employee_id', requirePermission('face-recognition:delete'), removeEnrollment);

module.exports = router;
