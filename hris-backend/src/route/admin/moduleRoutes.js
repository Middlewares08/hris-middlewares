const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');
const { getModulesWithPermissionsTree } = require('../../module/admin/controller/roles-and-permission/ModuleController');

router.get('/', verifyToken, requirePermission('roles-and-permissions:view'), getModulesWithPermissionsTree);

module.exports = router;