const express = require('express');
const router = express.Router();

const {
    getMyActivityLogs,
    getAllActivityLogs,
    getActivityLogByUuid,
    getActivityLogsByEmployee,
    createActivityLog,
    deleteActivityLog
} = require('../../module/admin/controller/employee/ActivityLogController');

const { verifyToken } = require('../../middleware/authMiddleware');

// SELF-SERVICE — only needs to know who the caller is (no permission gate)
router.get('/data/me', verifyToken, getMyActivityLogs); // 🎯 Declare before '/:uuid' so it isn't swallowed as a uuid param

// GENERAL ACCESS — token-verified only, per requirements
router.get('/', verifyToken, getAllActivityLogs);
router.get('/employee/:employee_id', verifyToken, getActivityLogsByEmployee);
router.get('/:uuid', verifyToken, getActivityLogByUuid);
router.post('/', verifyToken, createActivityLog);
router.delete('/:uuid', verifyToken, deleteActivityLog);

module.exports = router;
