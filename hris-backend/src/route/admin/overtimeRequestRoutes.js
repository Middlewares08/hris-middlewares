const express = require('express');
const router = express.Router();

const {
    getAllOvertimeRequests,
    getOvertimeRequestByUuid,
    getOvertimeRequestsByEmployee,
    getMyOvertimeRequests,
    createOvertimeRequest,
    updateOvertimeRequest,
    reviewOvertimeRequest,
    cancelOvertimeRequest,
    deleteOvertimeRequest,
} = require('../../module/admin/controller/attendance/OvertimeRequestController');

const { verifyToken } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');

// SELF-SERVICE (employee PWA, gated by the 'My Overtime' scope)
router.get('/me', verifyToken, requirePermission('my-overtime:view'), getMyOvertimeRequests); // 🎯 before '/:uuid' so it isn't swallowed as a uuid param
router.post('/', verifyToken, requirePermission('my-overtime:create'), createOvertimeRequest);
router.put('/:uuid', verifyToken, requirePermission('my-overtime:edit'), updateOvertimeRequest);
router.patch('/:uuid/cancel', verifyToken, requirePermission('my-overtime:edit'), cancelOvertimeRequest);

// ADMIN / MANAGER — gated by the 'Overtime Tracker' module permissions
router.get('/', verifyToken, requirePermission('overtime-tracker:view'), getAllOvertimeRequests);
router.get('/employee/:employee_id', verifyToken, requirePermission('overtime-tracker:view'), getOvertimeRequestsByEmployee);
router.get('/:uuid', verifyToken, requirePermission('overtime-tracker:view'), getOvertimeRequestByUuid);
router.patch('/:uuid/review', verifyToken, requirePermission('overtime-tracker:edit'), reviewOvertimeRequest);
router.delete('/:uuid', verifyToken, requirePermission('overtime-tracker:delete'), deleteOvertimeRequest);

module.exports = router;
