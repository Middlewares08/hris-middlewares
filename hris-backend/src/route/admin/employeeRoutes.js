const express = require('express');
const router = express.Router();
const {
    getEmployees, 
    getEmployeeByUuid, 
    createEmployee, 
    updateEmployee, 
    deleteEmployee
} = require('../../module/admin/controller/employee/EmployeeController');

const {
    getEmployeesWithBenefits,
    upsertGovernmentDetails,
    deleteGovernmentDetails
} = require('../../module/admin/controller/employee/GovernmentDetailController');

const {
    getAllDocuments,
    getDocumentsByEmployee,
    getDocumentById,
    createDocument,
    updateDocument,
    upsertDocument,
    deleteDocument
} = require('../../module/admin/controller/employee/DocumentController');

const { verifyToken } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');

router.use(verifyToken);

// All routes are prefixed under /api/employees in your app mounting setup
router.get('/', requirePermission('employee-management:view'), getEmployees);
router.get('/:uuid', requirePermission('employee-management:view'), getEmployeeByUuid);
router.post('/', requirePermission('employee-management:create'), createEmployee);
router.patch('/:uuid', requirePermission('employee-management:edit'), updateEmployee);
router.delete('/:uuid', requirePermission('employee-management:delete'), deleteEmployee);

// GOVERNMENT BENEFITS
router.get('/list/benefits', requirePermission('benefits:view'), getEmployeesWithBenefits);
router.post('/list/benefits', requirePermission('benefits:edit'), upsertGovernmentDetails);
router.delete('/list/benefits/:employeeId', requirePermission('benefits:delete'), deleteGovernmentDetails);

// DOCUMENTS
router.get('/list/documents', requirePermission('resume:view'), getAllDocuments);
router.get('/list/documents/employee/:employee_id', requirePermission('resume:view'), getDocumentsByEmployee);
router.get('/list/documents/:id', requirePermission('resume:view'), getDocumentById);
router.post('/list/documents/upsert', requirePermission('resume:edit'), upsertDocument);
router.post('/list/documents', requirePermission('resume:create'), createDocument);
router.put('/list/documents/:id', requirePermission('resume:edit'), updateDocument);
router.delete('/list/documents/:id', requirePermission('resume:delete'), deleteDocument);


module.exports = router;