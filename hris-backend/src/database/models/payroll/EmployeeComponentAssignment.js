// database/models/payroll/EmployeeComponentAssignment.js
//
// BRIDGE: employee.employees  <->  payroll.pay_components
// Carries recurring allowances / deductions and amortized loan balances.
const AuditModel = require('./AuditModel');

const STATUSES = ['active', 'paused', 'completed', 'cancelled'];

class EmployeeComponentAssignment extends AuditModel {
    static get tableName() { return 'payroll.employee_component_assignments'; }
    static get idColumn() { return 'id'; }

    static get STATUSES() { return STATUSES; }
    static get jsonAttributes() { return ['metadata']; }

    /** Assignments in force for an employee across [periodStart, periodEnd]. */
    static activeForEmployee(employeeId, periodStart, periodEnd, trx) {
        const start = String(periodStart).substring(0, 10);
        const end = String(periodEnd).substring(0, 10);
        return EmployeeComponentAssignment.query(trx)
            .where({ employee_id: employeeId, is_deleted: false, status: 'active' })
            .where('start_date', '<=', end)
            .where((b) => b.whereNull('end_date').orWhere('end_date', '>=', start))
            .withGraphFetched('component')
            .orderBy('id', 'asc');
    }

    static get relationMappings() {
        const Employee = require('../employee/Employee');
        const PayComponent = require('./PayComponent');
        return {
            employee: {
                relation: AuditModel.BelongsToOneRelation,
                modelClass: Employee,
                join: {
                    from: 'payroll.employee_component_assignments.employee_id',
                    to: 'employee.employees.id',
                },
                modify: (b) => b.select('id', 'uuid', 'first_name', 'last_name'),
            },
            component: {
                relation: AuditModel.BelongsToOneRelation,
                modelClass: PayComponent,
                join: {
                    from: 'payroll.employee_component_assignments.component_id',
                    to: 'payroll.pay_components.id',
                },
            },
        };
    }
}

module.exports = EmployeeComponentAssignment;
