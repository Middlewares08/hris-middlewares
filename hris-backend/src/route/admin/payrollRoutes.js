// src/route/admin/payrollRoutes.js
//
// Mounted at /payroll (see server.js).
//
// Permission slugs reuse the already-seeded modules — no seeder run required:
//   payroll-and-compensation:*  -> pay components, employee compensation, recurring assignments
//   statutory-and-compliance:*  -> SSS / PhilHealth / Pag-IBIG / withholding-tax tables
//   run-payroll:*               -> pay periods, payroll runs, payslips, adjustments
//
// Employee self-service (own payslips) is gated by verifyToken only.

const express = require('express');
const router = express.Router();

const { verifyToken } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');

const Component = require('../../module/admin/controller/payroll/PayComponentController');
const Statutory = require('../../module/admin/controller/payroll/StatutoryTableController');
const Compensation = require('../../module/admin/controller/payroll/EmployeeCompensationController');
const Assignment = require('../../module/admin/controller/payroll/ComponentAssignmentController');
const Period = require('../../module/admin/controller/payroll/PayPeriodController');
const Run = require('../../module/admin/controller/payroll/PayrollRunController');
const Payslip = require('../../module/admin/controller/payroll/PayslipController');

const SETUP = 'payroll-and-compensation';
const STAT = 'statutory-and-compliance';
const PROCESS = 'run-payroll';

/* ---------------------------------------------------------------- *
 * SELF-SERVICE — declared first so '/payslips/me' isn't captured
 * by the '/payslips/:uuid' param route.
 * ---------------------------------------------------------------- */
router.get('/payslips/me', verifyToken, Payslip.getMine);
router.get('/payslips/me/:uuid', verifyToken, Payslip.getMineByUuid);

/* ---------------------------------------------------------------- *
 * PAY COMPONENTS
 * ---------------------------------------------------------------- */
router.get('/components', verifyToken, requirePermission(`${SETUP}:view`), Component.getAll);
router.get('/components/:uuid', verifyToken, requirePermission(`${SETUP}:view`), Component.getByUuid);
router.post('/components', verifyToken, requirePermission(`${SETUP}:create`), Component.create);
router.put('/components/:uuid', verifyToken, requirePermission(`${SETUP}:edit`), Component.update);
router.delete('/components/:uuid', verifyToken, requirePermission(`${SETUP}:delete`), Component.remove);

/* ---------------------------------------------------------------- *
 * STATUTORY TABLES
 * ---------------------------------------------------------------- */
router.get('/statutory-tables', verifyToken, requirePermission(`${STAT}:view`), Statutory.getAll);
router.get('/statutory-tables/:uuid', verifyToken, requirePermission(`${STAT}:view`), Statutory.getByUuid);
router.post('/statutory-tables', verifyToken, requirePermission(`${STAT}:create`), Statutory.create);
router.put('/statutory-tables/:uuid', verifyToken, requirePermission(`${STAT}:edit`), Statutory.update);
router.delete('/statutory-tables/:uuid', verifyToken, requirePermission(`${STAT}:delete`), Statutory.remove);

/* ---------------------------------------------------------------- *
 * EMPLOYEE COMPENSATION
 * ---------------------------------------------------------------- */
router.get('/compensations', verifyToken, requirePermission(`${SETUP}:view`), Compensation.getAll);
router.get('/compensations/employee/:employee_id/active', verifyToken, requirePermission(`${SETUP}:view`), Compensation.getActiveForEmployee);
router.get('/compensations/:uuid', verifyToken, requirePermission(`${SETUP}:view`), Compensation.getByUuid);
router.post('/compensations', verifyToken, requirePermission(`${SETUP}:create`), Compensation.create);
router.put('/compensations/:uuid', verifyToken, requirePermission(`${SETUP}:edit`), Compensation.update);
router.delete('/compensations/:uuid', verifyToken, requirePermission(`${SETUP}:delete`), Compensation.remove);

/* ---------------------------------------------------------------- *
 * RECURRING COMPONENT ASSIGNMENTS (bridge)
 * ---------------------------------------------------------------- */
router.get('/assignments', verifyToken, requirePermission(`${SETUP}:view`), Assignment.getAll);
router.get('/assignments/:uuid', verifyToken, requirePermission(`${SETUP}:view`), Assignment.getByUuid);
router.post('/assignments', verifyToken, requirePermission(`${SETUP}:create`), Assignment.create);
router.put('/assignments/:uuid', verifyToken, requirePermission(`${SETUP}:edit`), Assignment.update);
router.delete('/assignments/:uuid', verifyToken, requirePermission(`${SETUP}:delete`), Assignment.remove);

/* ---------------------------------------------------------------- *
 * PAY PERIODS
 * ---------------------------------------------------------------- */
router.get('/periods', verifyToken, requirePermission(`${PROCESS}:view`), Period.getAll);
router.get('/periods/:uuid', verifyToken, requirePermission(`${PROCESS}:view`), Period.getByUuid);
router.post('/periods', verifyToken, requirePermission(`${PROCESS}:create`), Period.create);
router.put('/periods/:uuid', verifyToken, requirePermission(`${PROCESS}:edit`), Period.update);
router.delete('/periods/:uuid', verifyToken, requirePermission(`${PROCESS}:delete`), Period.remove);

/* ---------------------------------------------------------------- *
 * PAYROLL RUNS + queued ADJUSTMENTS
 * ---------------------------------------------------------------- */
router.get('/runs', verifyToken, requirePermission(`${PROCESS}:view`), Run.getAll);
router.get('/runs/:uuid', verifyToken, requirePermission(`${PROCESS}:view`), Run.getByUuid);
router.post('/runs', verifyToken, requirePermission(`${PROCESS}:create`), Run.create);
router.put('/runs/:uuid', verifyToken, requirePermission(`${PROCESS}:edit`), Run.update);
router.post('/runs/:uuid/calculate', verifyToken, requirePermission(`${PROCESS}:edit`), Run.calculate);
router.patch('/runs/:uuid/approve', verifyToken, requirePermission(`${PROCESS}:edit`), Run.approve);
router.patch('/runs/:uuid/mark-paid', verifyToken, requirePermission(`${PROCESS}:edit`), Run.markPaid);
router.patch('/runs/:uuid/cancel', verifyToken, requirePermission(`${PROCESS}:edit`), Run.cancel);
router.delete('/runs/:uuid', verifyToken, requirePermission(`${PROCESS}:delete`), Run.remove);

router.get('/runs/:run_uuid/adjustments', verifyToken, requirePermission(`${PROCESS}:view`), Payslip.listAdjustments);
router.post('/runs/:run_uuid/adjustments', verifyToken, requirePermission(`${PROCESS}:edit`), Payslip.createAdjustment);
router.delete('/adjustments/:uuid', verifyToken, requirePermission(`${PROCESS}:edit`), Payslip.removeAdjustment);

/* ---------------------------------------------------------------- *
 * PAYSLIPS (admin)
 * ---------------------------------------------------------------- */
router.get('/payslips', verifyToken, requirePermission(`${PROCESS}:view`), Payslip.getAll);
router.get('/payslips/:uuid', verifyToken, requirePermission(`${PROCESS}:view`), Payslip.getByUuid);
router.patch('/payslips/:uuid/status', verifyToken, requirePermission(`${PROCESS}:edit`), Payslip.setStatus);

module.exports = router;
