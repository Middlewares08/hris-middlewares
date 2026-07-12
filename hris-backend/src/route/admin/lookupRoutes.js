const express = require('express');
const router = express.Router();

// DEPARTMENT
const {
    getAllDepartments,
    getDepartmentByUuid,
    createDepartment,
    updateDepartment,
    deleteDepartment
} = require('../../module/admin/controller/lookups/DepartmentController');

// POSITION
const {
    createPosition,
    getPositions,
    getPositionByUuid,
    updatePosition,
    deletePosition
} = require('../../module/admin/controller/lookups/PositionController');

const { verifyToken } = require('../../middleware/authMiddleware');

router.use(verifyToken);

// DEPARTMENT
router.get('/departments', getAllDepartments);
router.get('/departments/:uuid', getDepartmentByUuid); // 🎯 Swapped parameter token
router.post('/departments/', createDepartment);
router.put('/departments/:uuid', updateDepartment);    // 🎯 Swapped parameter token
router.delete('/departments/:uuid', deleteDepartment); // 🎯 Swapped parameter token

// POSITION
router.get('/positions', getPositions);
router.post('/positions', createPosition);
router.get('/positions/:uuid', getPositionByUuid);
router.put('/positions/:uuid', updatePosition);
router.delete('/positions/:uuid', deletePosition);


module.exports = router;