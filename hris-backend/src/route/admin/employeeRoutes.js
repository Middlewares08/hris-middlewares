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

const { verifyToken } = require('../../middleware/authMiddleware');

router.use(verifyToken);

// All routes are prefixed under /api/employees in your app mounting setup
router.get('/', getEmployees);
router.get('/:uuid', getEmployeeByUuid);
router.post('/', createEmployee);
router.patch('/:uuid', updateEmployee);
router.delete('/:uuid', deleteEmployee);

router.get('/list/benefits', getEmployeesWithBenefits);
router.post('/list/benefits', upsertGovernmentDetails);
router.delete('/list/benefits/:employeeId', deleteGovernmentDetails);

module.exports = router;