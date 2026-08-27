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

// SELF-SERVICE — just needs to know who the caller is, no admin permission required
router.post('/clock-in', verifyToken, clockIn);
router.post('/clock-out', verifyToken, clockOut);
router.get('/me', verifyToken, getMyAttendance); // 🎯 Must be declared before '/:uuid' or it'll be swallowed as a uuid param

// ATTENDANCE LOGS (admin/manager access, gated by the 'Attendance Logs' module permissions)
router.get('/', verifyToken, requirePermission('attendance-logs:view'), getAllAttendance);
router.get('/employee/:employee_id', verifyToken, requirePermission('attendance-logs:view'), getAttendanceByEmployee);
router.get('/:uuid', verifyToken, requirePermission('attendance-logs:view'), getAttendanceByUuid);
router.post('/', verifyToken, requirePermission('attendance-logs:create'), createAttendance);
router.put('/:uuid', verifyToken, requirePermission('attendance-logs:edit'), updateAttendance);
router.delete('/:uuid', verifyToken, requirePermission('attendance-logs:delete'), deleteAttendance);

module.exports = router;
