// src/route/admin/payrollRoutes.js
//
// Mounted at /payroll (see server.js).
//
// One permission module per Payroll sidebar submenu page (see
// PAYROLL_SUBMENU_MODULES in permissionMatrix.js):
//   payroll-and-compensation:*  -> employee compensation, recurring assignments (Employee Directory pages)
//   pay-components:*            -> pay components
//   statutory-and-compliance:*  -> SSS / PhilHealth / Pag-IBIG / withholding-tax tables
//   pay-periods:*               -> pay periods
//   payroll-runs:*              -> payroll runs, their payslips + adjustments
//   payslip-requests:*          -> admin review of employee payslip-copy requests
//   employer-profile:*          -> registered-employer identity for gov filings
//   ewt-payees:*                -> EWT payee master + income payment log (BIR 2307)
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
const PayslipRequest = require('../../module/admin/controller/payroll/PayslipRequestController');
const EmployerProfile = require('../../module/admin/controller/payroll/EmployerProfileController');
const GovFiling = require('../../module/admin/controller/payroll/GovFilingController');
const EwtPayee = require('../../module/admin/controller/payroll/EwtPayeeController');
const EwtPayment = require('../../module/admin/controller/payroll/EwtPaymentController');

const SETUP = 'payroll-and-compensation';
const STAT = 'statutory-and-compliance';
const COMPONENTS = 'pay-components';
const PERIODS = 'pay-periods';
const RUNS = 'payroll-runs';
const REQUESTS = 'payslip-requests';
const EMPLOYER_PROFILE = 'employer-profile';
const EWT = 'ewt-payees';

/* ---------------------------------------------------------------- *
 * SELF-SERVICE (employee PWA, gated by the 'My Payslips' scope) —
 * declared first so '/payslips/me' isn't captured by the
 * '/payslips/:uuid' param route.
 * ---------------------------------------------------------------- */
router.get('/payslips/me', verifyToken, requirePermission('my-payslips:view'), Payslip.getMine);
router.get('/payslips/me/:uuid/pdf', verifyToken, requirePermission('my-payslips:view'), Payslip.getMinePdf);
router.get('/payslips/me/:uuid', verifyToken, requirePermission('my-payslips:view'), Payslip.getMineByUuid);

// Payslip copy requests (employee files, HR fulfils). '/me' before any ':uuid' route.
router.get('/payslip-requests/me', verifyToken, requirePermission('my-payslips:view'), Payslip.getMineRequests);
router.post('/payslip-requests', verifyToken, requirePermission('my-payslips:create'), Payslip.createRequest);
router.patch('/payslip-requests/me/:uuid/cancel', verifyToken, requirePermission('my-payslips:create'), Payslip.cancelRequest);
// The nearest upcoming pay date — drives the employee dashboard "Next Payday" tile.
// Authenticated only (no scope) — it's a single harmless date.
// Declared before '/periods/:uuid' so 'next' isn't captured as a uuid param.
router.get('/periods/next', verifyToken, Period.getNext);

/* ---------------------------------------------------------------- *
 * PAY COMPONENTS
 * ---------------------------------------------------------------- */
router.get('/components', verifyToken, requirePermission(`${COMPONENTS}:view`), Component.getAll);
router.get('/components/:uuid', verifyToken, requirePermission(`${COMPONENTS}:view`), Component.getByUuid);
router.post('/components', verifyToken, requirePermission(`${COMPONENTS}:create`), Component.create);
router.put('/components/:uuid', verifyToken, requirePermission(`${COMPONENTS}:edit`), Component.update);
router.delete('/components/:uuid', verifyToken, requirePermission(`${COMPONENTS}:delete`), Component.remove);

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
 * EMPLOYER PROFILE (registered-employer identity for government filings)
 * ---------------------------------------------------------------- */
router.get('/employer-profile', verifyToken, requirePermission(`${EMPLOYER_PROFILE}:view`), EmployerProfile.get);
router.put('/employer-profile', verifyToken, requirePermission(`${EMPLOYER_PROFILE}:edit`), EmployerProfile.update);

/* ---------------------------------------------------------------- *
 * EWT PAYEES + INCOME PAYMENTS (contractors / professionals / talents / suppliers — BIR 2307)
 * ---------------------------------------------------------------- */
router.get('/ewt-payees', verifyToken, requirePermission(`${EWT}:view`), EwtPayee.getAll);
router.get('/ewt-payees/:uuid', verifyToken, requirePermission(`${EWT}:view`), EwtPayee.getByUuid);
router.post('/ewt-payees', verifyToken, requirePermission(`${EWT}:create`), EwtPayee.create);
router.put('/ewt-payees/:uuid', verifyToken, requirePermission(`${EWT}:edit`), EwtPayee.update);
router.delete('/ewt-payees/:uuid', verifyToken, requirePermission(`${EWT}:delete`), EwtPayee.remove);

router.get('/ewt-payees/:payee_uuid/payments', verifyToken, requirePermission(`${EWT}:view`), EwtPayment.listForPayee);
router.post('/ewt-payees/:payee_uuid/payments', verifyToken, requirePermission(`${EWT}:create`), EwtPayment.createForPayee);
router.delete('/ewt-payments/:uuid', verifyToken, requirePermission(`${EWT}:delete`), EwtPayment.remove);

/* ---------------------------------------------------------------- *
 * GOVERNMENT FILING ARTIFACTS (BIR / SSS / PhilHealth / Pag-IBIG)
 * ---------------------------------------------------------------- */
router.get('/gov-forms', verifyToken, requirePermission('government-forms:view'), GovFiling.listForms);
router.get('/gov-forms/preview', verifyToken, requirePermission('government-forms:view'), GovFiling.preview);
router.get('/gov-forms/download', verifyToken, requirePermission('government-forms:generate'), GovFiling.download);

/* ---------------------------------------------------------------- *
 * PAY PERIODS
 * ---------------------------------------------------------------- */
router.get('/periods', verifyToken, requirePermission(`${PERIODS}:view`), Period.getAll);
router.get('/periods/:uuid', verifyToken, requirePermission(`${PERIODS}:view`), Period.getByUuid);
router.post('/periods', verifyToken, requirePermission(`${PERIODS}:create`), Period.create);
router.put('/periods/:uuid', verifyToken, requirePermission(`${PERIODS}:edit`), Period.update);
router.delete('/periods/:uuid', verifyToken, requirePermission(`${PERIODS}:delete`), Period.remove);

/* ---------------------------------------------------------------- *
 * PAYROLL RUNS + queued ADJUSTMENTS
 * ---------------------------------------------------------------- */
router.get('/runs', verifyToken, requirePermission(`${RUNS}:view`), Run.getAll);
router.get('/runs/:uuid', verifyToken, requirePermission(`${RUNS}:view`), Run.getByUuid);
router.post('/runs', verifyToken, requirePermission(`${RUNS}:create`), Run.create);
router.put('/runs/:uuid', verifyToken, requirePermission(`${RUNS}:edit`), Run.update);
router.post('/runs/:uuid/calculate', verifyToken, requirePermission(`${RUNS}:edit`), Run.calculate);
router.patch('/runs/:uuid/approve', verifyToken, requirePermission(`${RUNS}:edit`), Run.approve);
router.patch('/runs/:uuid/mark-paid', verifyToken, requirePermission(`${RUNS}:edit`), Run.markPaid);
router.patch('/runs/:uuid/cancel', verifyToken, requirePermission(`${RUNS}:edit`), Run.cancel);
router.delete('/runs/:uuid', verifyToken, requirePermission(`${RUNS}:delete`), Run.remove);

router.get('/runs/:run_uuid/adjustments', verifyToken, requirePermission(`${RUNS}:view`), Payslip.listAdjustments);
router.post('/runs/:run_uuid/adjustments', verifyToken, requirePermission(`${RUNS}:edit`), Payslip.createAdjustment);
router.delete('/adjustments/:uuid', verifyToken, requirePermission(`${RUNS}:edit`), Payslip.removeAdjustment);

/* ---------------------------------------------------------------- *
 * PAYSLIPS (admin)
 * ---------------------------------------------------------------- */
router.get('/payslips', verifyToken, requirePermission(`${RUNS}:view`), Payslip.getAll);
router.get('/payslips/:uuid/pdf', verifyToken, requirePermission(`${RUNS}:view`), Payslip.getPdf);
router.get('/payslips/:uuid', verifyToken, requirePermission(`${RUNS}:view`), Payslip.getByUuid);
router.patch('/payslips/:uuid/status', verifyToken, requirePermission(`${RUNS}:edit`), Payslip.setStatus);

/* ---------------------------------------------------------------- *
 * PAYSLIP COPY REQUESTS (admin review)
 * ---------------------------------------------------------------- */
router.get('/payslip-requests', verifyToken, requirePermission(`${REQUESTS}:view`), PayslipRequest.getAll);
router.patch('/payslip-requests/:uuid/fulfill', verifyToken, requirePermission(`${REQUESTS}:edit`), PayslipRequest.fulfill);
router.patch('/payslip-requests/:uuid/reject', verifyToken, requirePermission(`${REQUESTS}:edit`), PayslipRequest.reject);
router.delete('/payslip-requests/:uuid', verifyToken, requirePermission(`${REQUESTS}:delete`), PayslipRequest.remove);

module.exports = router;
