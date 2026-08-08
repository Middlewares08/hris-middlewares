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

router.use(verifyToken);

// All routes are prefixed under /api/employees in your app mounting setup
router.get('/', getEmployees);
router.get('/:uuid', getEmployeeByUuid);
router.post('/', createEmployee);
router.patch('/:uuid', updateEmployee);
router.delete('/:uuid', deleteEmployee);

// GOVERNMENT BENEFITS
router.get('/list/benefits', getEmployeesWithBenefits);
router.post('/list/benefits', upsertGovernmentDetails);
router.delete('/list/benefits/:employeeId', deleteGovernmentDetails);

// DOCUMENTS
router.get('/list/documents', getAllDocuments);
router.get('/list/documents/employee/:employee_id', getDocumentsByEmployee);
router.get('/list/documents/:id', getDocumentById);                    
router.post('/list/documents/upsert', upsertDocument);                 
router.post('/list/documents', createDocument);                      
router.put('/list/documents/:id', updateDocument);                   
router.delete('/list/documents/:id', deleteDocument);            


module.exports = router;