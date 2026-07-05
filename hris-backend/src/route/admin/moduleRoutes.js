const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/authMiddleware');
const { getModulesWithPermissionsTree } = require('../../module/admin/controller/roles-and-permission/ModuleController');

router.get('/', verifyToken, getModulesWithPermissionsTree);

module.exports = router;