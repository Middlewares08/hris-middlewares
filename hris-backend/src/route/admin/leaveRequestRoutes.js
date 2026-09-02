const express = require('express');
const router = express.Router();

const {
    getAllLeaveRequests,
    getLeaveRequestByUuid,
    getLeaveRequestsByEmployee,
    getMyLeaveRequests,
    createLeaveRequest,
    updateLeaveRequest,
    reviewLeaveRequest,
    cancelLeaveRequest,
    deleteLeaveRequest
} = require('../../module/admin/controller/attendance/LeaveRequestController');

const { verifyToken } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');

// SELF-SERVICE (employee PWA, gated by the 'My Leave' scope)
router.get('/me', verifyToken, requirePermission('my-leave:view'), getMyLeaveRequests); // 🎯 Must be declared before '/:uuid' or it'll be swallowed as a uuid param
router.post('/', verifyToken, requirePermission('my-leave:create'), createLeaveRequest);
router.put('/:uuid', verifyToken, requirePermission('my-leave:edit'), updateLeaveRequest);
router.patch('/:uuid/cancel', verifyToken, requirePermission('my-leave:edit'), cancelLeaveRequest);

// LEAVE REQUESTS (admin/manager access, gated by the 'Leave Requests' module permissions)
router.get('/', verifyToken, requirePermission('leave-request:view'), getAllLeaveRequests);
router.get('/employee/:employee_id', verifyToken, requirePermission('leave-request:view'), getLeaveRequestsByEmployee);
router.get('/:uuid', verifyToken, requirePermission('leave-request:view'), getLeaveRequestByUuid);
router.patch('/:uuid/review', verifyToken, requirePermission('leave-request:edit'), reviewLeaveRequest);
router.delete('/:uuid', verifyToken, requirePermission('leave-request:delete'), deleteLeaveRequest);

module.exports = router;
