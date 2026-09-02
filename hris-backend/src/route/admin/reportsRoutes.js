const express = require('express');
const router = express.Router();

const { getReport } = require('../../module/admin/controller/reports/ReportsController');

const { verifyToken } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');

// ADMIN — every report is gated by the 'Reports' module permission.
// GET /reports/<key>?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
//   keys: headcount | attendance | absence | leave | overtime | payroll |
//         turnover | new-hires | separations | departments | performance | training
router.get('/:key', verifyToken, requirePermission('reports:view'), getReport);

module.exports = router;
