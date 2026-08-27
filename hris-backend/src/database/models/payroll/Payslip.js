// database/models/payroll/Payslip.js
const AuditModel = require('./AuditModel');

const STATUSES = ['draft', 'calculated', 'on_hold', 'released', 'cancelled'];
const PAYMENT_METHODS = ['bank_transfer', 'cash', 'check'];

class Payslip extends AuditModel {
    static get tableName() { return 'payroll.payslips'; }
    static get idColumn() { return 'id'; }

    static get STATUSES() { return STATUSES; }
    static get PAYMENT_METHODS() { return PAYMENT_METHODS; }

    // Numeric columns Postgres returns as strings — coerce for the API consumer.
    $parseDatabaseJson(json) {
        json = super.$parseDatabaseJson(json);
        for (const key of NUMERIC_COLUMNS) {
            if (json[key] !== null && json[key] !== undefined) json[key] = Number(json[key]);
        }
        return json;
    }

    static get relationMappings() {
        const PayrollRun = require('./PayrollRun');
        const PayslipLine = require('./PayslipLine');
        const Employee = require('../employee/Employee');

        return {
            run: {
                relation: AuditModel.BelongsToOneRelation,
                modelClass: PayrollRun,
                join: { from: 'payroll.payslips.payroll_run_id', to: 'payroll.payroll_runs.id' },
            },
            lines: {
                relation: AuditModel.HasManyRelation,
                modelClass: PayslipLine,
                join: { from: 'payroll.payslips.id', to: 'payroll.payslip_lines.payslip_id' },
                modify: (b) => b.where('payroll.payslip_lines.is_deleted', false).orderBy('sequence', 'asc'),
            },
            employee: {
                relation: AuditModel.BelongsToOneRelation,
                modelClass: Employee,
                join: { from: 'payroll.payslips.employee_id', to: 'employee.employees.id' },
                modify: (b) => b.select('id', 'uuid', 'first_name', 'last_name'),
            },
        };
    }
}

const NUMERIC_COLUMNS = [
    'pay_rate', 'monthly_equivalent', 'days_worked', 'hours_worked', 'days_absent',
    'overtime_hours', 'basic_pay', 'total_earnings', 'gross_pay', 'taxable_income',
    'non_taxable_income', 'total_deductions', 'total_employer_contributions',
    'withholding_tax', 'net_pay',
];

module.exports = Payslip;
