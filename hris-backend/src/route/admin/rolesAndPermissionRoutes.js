const express = require('express');
const router = express.Router();
const { getRoles, updateRole, createRole, deleteRole } = require('../../module/admin/controller/roles-and-permission/RoleControler');
const { getPermissionsByRoleId } = require('../../module/admin/controller/roles-and-permission/RolePermissionController')
const { verifyToken } = require('../../middleware/authMiddleware');


router.get('/', verifyToken, getRoles);
router.post('/', verifyToken, createRole);
router.put('/:id', verifyToken, updateRole);
router.delete('/:id', verifyToken, deleteRole);

router.get('/:roleId/permissions', verifyToken, getPermissionsByRoleId);

module.exports = router;