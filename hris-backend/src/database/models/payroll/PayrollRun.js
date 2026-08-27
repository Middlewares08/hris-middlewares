// database/models/payroll/PayrollRun.js
const AuditModel = require('./AuditModel');

const RUN_TYPES = ['regular', 'off_cycle', 'thirteenth_month', 'final_pay', 'adjustment'];
const STATUSES = ['draft', 'calculating', 'calculated', 'approved', 'paid', 'cancelled'];

// Which status may move to which — the single source of truth for run lifecycle guards.
const TRANSITIONS = {
    draft: ['calculating', 'calculated', 'cancelled'],
    calculating: ['calculated', 'draft', 'cancelled'],
    calculated: ['calculating', 'approved', 'cancelled'],
    approved: ['paid', 'calculated', 'cancelled'],
    paid: [],
    cancelled: [],
};

class PayrollRun extends AuditModel {
    static get tableName() { return 'payroll.payroll_runs'; }
    static get idColumn() { return 'id'; }

    static get RUN_TYPES() { return RUN_TYPES; }
    static get STATUSES() { return STATUSES; }

    static canTransition(from, to) {
        return Array.isArray(TRANSITIONS[from]) && TRANSITIONS[from].includes(to);
    }

    static get relationMappings() {
        const PayPeriod = require('./PayPeriod');
        const Payslip = require('./Payslip');
        const PayslipAdjustment = require('./PayslipAdjustment');
        const Employee = require('../employee/Employee');

        const employeeSummary = (b) => b.select('id', 'uuid', 'first_name', 'last_name');

        return {
            period: {
                relation: AuditModel.BelongsToOneRelation,
                modelClass: PayPeriod,
                join: { from: 'payroll.payroll_runs.pay_period_id', to: 'payroll.pay_periods.id' },
            },
            payslips: {
                relation: AuditModel.HasManyRelation,
                modelClass: Payslip,
                join: { from: 'payroll.payroll_runs.id', to: 'payroll.payslips.payroll_run_id' },
            },
            adjustments: {
                relation: AuditModel.HasManyRelation,
                modelClass: PayslipAdjustment,
                join: { from: 'payroll.payroll_runs.id', to: 'payroll.payslip_adjustments.payroll_run_id' },
            },
            approver: {
                relation: AuditModel.BelongsToOneRelation,
                modelClass: Employee,
                join: { from: 'payroll.payroll_runs.approved_by', to: 'employee.employees.id' },
                modify: employeeSummary,
            },
        };
    }
}

module.exports = PayrollRun;
