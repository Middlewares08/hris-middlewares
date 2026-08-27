// database/models/payroll/PayPeriod.js
const AuditModel = require('./AuditModel');

const FREQUENCIES = ['monthly', 'semi_monthly', 'weekly', 'bi_weekly'];
const SEQUENCES = ['first_cutoff', 'second_cutoff', 'monthly', 'special'];
const STATUSES = ['open', 'locked', 'closed'];

class PayPeriod extends AuditModel {
    static get tableName() { return 'payroll.pay_periods'; }
    static get idColumn() { return 'id'; }

    static get FREQUENCIES() { return FREQUENCIES; }
    static get SEQUENCES() { return SEQUENCES; }
    static get STATUSES() { return STATUSES; }

    static get relationMappings() {
        const PayrollRun = require('./PayrollRun');
        return {
            runs: {
                relation: AuditModel.HasManyRelation,
                modelClass: PayrollRun,
                join: {
                    from: 'payroll.pay_periods.id',
                    to: 'payroll.payroll_runs.pay_period_id',
                },
            },
        };
    }
}

module.exports = PayPeriod;
