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
    deletePosition,
    getPositionsWithNoPagination
} = require('../../module/admin/controller/lookups/PositionController');

const { verifyToken } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');

router.use(verifyToken);

// DEPARTMENT
router.get('/departments', requirePermission('departments:view'), getAllDepartments);
router.get('/departments/:uuid', requirePermission('departments:view'), getDepartmentByUuid);
router.post('/departments/', requirePermission('departments:create'), createDepartment);
router.put('/departments/:uuid', requirePermission('departments:edit'), updateDepartment);
router.delete('/departments/:uuid', requirePermission('departments:delete'), deleteDepartment);

// POSITION
router.get('/positions', requirePermission('positions:view'), getPositions);
router.post('/positions', requirePermission('positions:create'), createPosition);
router.get('/positions/:uuid', requirePermission('positions:view'), getPositionByUuid);
router.put('/positions/:uuid', requirePermission('positions:edit'), updatePosition);
router.delete('/positions/:uuid', requirePermission('positions:delete'), deletePosition);
router.get('/positions/list/data', requirePermission('positions:view'), getPositionsWithNoPagination);

module.exports = router;