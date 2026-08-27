const express = require('express');
const router = express.Router();
const { getRoles, updateRole, createRole, deleteRole } = require('../../module/admin/controller/roles-and-permission/RoleControler');
const { getPermissionsByRoleId } = require('../../module/admin/controller/roles-and-permission/RolePermissionController')
const { verifyToken } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');


router.get('/', verifyToken, requirePermission('roles-and-permissions:view'), getRoles);
router.post('/', verifyToken, requirePermission('roles-and-permissions:create'), createRole);
router.put('/:id', verifyToken, requirePermission('roles-and-permissions:edit'), updateRole);
router.delete('/:id', verifyToken, requirePermission('roles-and-permissions:delete'), deleteRole);

router.get('/:roleId/permissions', verifyToken, requirePermission('roles-and-permissions:view'), getPermissionsByRoleId);

module.exports = router;