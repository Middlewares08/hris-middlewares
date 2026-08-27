// database/models/payroll/PayslipAdjustment.js
const AuditModel = require('./AuditModel');

const ADJUSTMENT_TYPES = ['earning', 'deduction'];
const STATUSES = ['pending', 'applied', 'cancelled'];

class PayslipAdjustment extends AuditModel {
    static get tableName() { return 'payroll.payslip_adjustments'; }
    static get idColumn() { return 'id'; }

    static get ADJUSTMENT_TYPES() { return ADJUSTMENT_TYPES; }
    static get STATUSES() { return STATUSES; }

    $parseDatabaseJson(json) {
        json = super.$parseDatabaseJson(json);
        if (json.amount !== null && json.amount !== undefined) json.amount = Number(json.amount);
        return json;
    }

    static get relationMappings() {
        const Employee = require('../employee/Employee');
        const PayComponent = require('./PayComponent');
        const PayrollRun = require('./PayrollRun');
        return {
            employee: {
                relation: AuditModel.BelongsToOneRelation,
                modelClass: Employee,
                join: { from: 'payroll.payslip_adjustments.employee_id', to: 'employee.employees.id' },
                modify: (b) => b.select('id', 'uuid', 'first_name', 'last_name'),
            },
            component: {
                relation: AuditModel.BelongsToOneRelation,
                modelClass: PayComponent,
                join: { from: 'payroll.payslip_adjustments.component_id', to: 'payroll.pay_components.id' },
            },
            run: {
                relation: AuditModel.BelongsToOneRelation,
                modelClass: PayrollRun,
                join: { from: 'payroll.payslip_adjustments.payroll_run_id', to: 'payroll.payroll_runs.id' },
            },
        };
    }
}

module.exports = PayslipAdjustment;
