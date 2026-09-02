const express = require('express');
const router = express.Router();

const { list, create, update, remove } = require('../../module/admin/controller/attendance/HolidayController');

const { verifyToken } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');

router.use(verifyToken);

router.get('/', requirePermission('shift-and-rostering:view'), list);
router.post('/', requirePermission('shift-and-rostering:create'), create);
router.put('/:uuid', requirePermission('shift-and-rostering:edit'), update);
router.delete('/:uuid', requirePermission('shift-and-rostering:delete'), remove);

module.exports = router;
