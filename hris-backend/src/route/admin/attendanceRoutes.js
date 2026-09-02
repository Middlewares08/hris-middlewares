const express = require('express');
const router = express.Router();

const {
    getAllAttendance,
    getAttendanceByUuid,
    getAttendanceByEmployee,
    getMyAttendance,
    clockIn,
    clockOut,
    createAttendance,
    updateAttendance,
    deleteAttendance
} = require('../../module/admin/controller/attendance/AttendanceController');

const { verifyToken } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');
const { singleFile } = require('../../middleware/uploadMiddleware');

// SELF-SERVICE (employee PWA, gated by the 'My Attendance' scope).
// `singleFile('image')` parses an optional face-verification photo (multipart);
// JSON / base64 bodies pass straight through.
router.post('/clock-in', verifyToken, requirePermission('my-attendance:create'), singleFile('image'), clockIn);
router.post('/clock-out', verifyToken, requirePermission('my-attendance:create'), singleFile('image'), clockOut);
router.get('/me', verifyToken, requirePermission('my-attendance:view'), getMyAttendance); // 🎯 Must be declared before '/:uuid' or it'll be swallowed as a uuid param

// ATTENDANCE LOGS (admin/manager access, gated by the 'Attendance Logs' module permissions)
router.get('/', verifyToken, requirePermission('attendance-logs:view'), getAllAttendance);
router.get('/employee/:employee_id', verifyToken, requirePermission('attendance-logs:view'), getAttendanceByEmployee);
router.get('/:uuid', verifyToken, requirePermission('attendance-logs:view'), getAttendanceByUuid);
router.post('/', verifyToken, requirePermission('attendance-logs:create'), createAttendance);
router.put('/:uuid', verifyToken, requirePermission('attendance-logs:edit'), updateAttendance);
router.delete('/:uuid', verifyToken, requirePermission('attendance-logs:delete'), deleteAttendance);

module.exports = router;
