const express = require('express');
const router = express.Router();

const {
    list, listAll, getByUuid, create, update, remove, assign, employeeAssignments,
} = require('../../module/admin/controller/attendance/WorkScheduleController');

const { verifyToken } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');

router.use(verifyToken);

// Declared before '/:uuid' so they aren't swallowed as a uuid param.
router.get('/list/all', requirePermission('shift-and-rostering:view'), listAll);
router.get('/employee/:employeeId', requirePermission('shift-and-rostering:view'), employeeAssignments);
router.post('/assign', requirePermission('shift-and-rostering:edit'), assign);

router.get('/', requirePermission('shift-and-rostering:view'), list);
router.get('/:uuid', requirePermission('shift-and-rostering:view'), getByUuid);
router.post('/', requirePermission('shift-and-rostering:create'), create);
router.put('/:uuid', requirePermission('shift-and-rostering:edit'), update);
router.delete('/:uuid', requirePermission('shift-and-rostering:delete'), remove);

module.exports = router;
