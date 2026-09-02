// database/models/payroll/PayslipRequest.js
const AuditModel = require('./AuditModel');

const STATUSES = ['pending', 'fulfilled', 'rejected', 'cancelled'];

class PayslipRequest extends AuditModel {
    static get tableName() { return 'payroll.payslip_requests'; }
    static get idColumn() { return 'id'; }

    static get STATUSES() { return STATUSES; }

    static get relationMappings() {
        const Payslip = require('./Payslip');
        const Employee = require('../employee/Employee');

        const employeeSummary = (b) =>
            b.select('id', 'uuid', 'employee_id', 'first_name', 'last_name');

        return {
            employee: {
                relation: AuditModel.BelongsToOneRelation,
                modelClass: Employee,
                join: { from: 'payroll.payslip_requests.employee_id', to: 'employee.employees.id' },
                modify: employeeSummary,
            },
            reviewer: {
                relation: AuditModel.BelongsToOneRelation,
                modelClass: Employee,
                join: { from: 'payroll.payslip_requests.reviewed_by', to: 'employee.employees.id' },
                modify: employeeSummary,
            },
            payslip: {
                relation: AuditModel.BelongsToOneRelation,
                modelClass: Payslip,
                join: { from: 'payroll.payslip_requests.payslip_id', to: 'payroll.payslips.id' },
            },
        };
    }
}

module.exports = PayslipRequest;
