const express = require('express');
const router = express.Router();
const {
    getAllDepartments,
    getDepartmentByUuid,
    createDepartment,
    updateDepartment,
    deleteDepartment
} = require('../../module/admin/controller/lookups/DepartmentController');
const { verifyToken } = require('../../middleware/authMiddleware');

router.get('/departments', verifyToken, getAllDepartments);
router.get('/departments/:uuid', verifyToken, getDepartmentByUuid); // 🎯 Swapped parameter token
router.post('/departments/', verifyToken, createDepartment);
router.put('/departments/:uuid', verifyToken, updateDepartment);    // 🎯 Swapped parameter token
router.delete('/departments/:uuid', verifyToken, deleteDepartment); // 🎯 Swapped parameter token

module.exports = router;