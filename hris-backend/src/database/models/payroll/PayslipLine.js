// database/models/payroll/PayslipLine.js
const AuditModel = require('./AuditModel');

const LINE_TYPES = ['earning', 'deduction', 'employer_contribution'];
const SOURCES = ['basic', 'attendance', 'recurring', 'adjustment', 'statutory', 'manual', 'system'];

class PayslipLine extends AuditModel {
    static get tableName() { return 'payroll.payslip_lines'; }
    static get idColumn() { return 'id'; }

    static get LINE_TYPES() { return LINE_TYPES; }
    static get SOURCES() { return SOURCES; }
    static get jsonAttributes() { return ['metadata']; }

    $parseDatabaseJson(json) {
        json = super.$parseDatabaseJson(json);
        for (const key of ['quantity', 'rate', 'amount']) {
            if (json[key] !== null && json[key] !== undefined) json[key] = Number(json[key]);
        }
        return json;
    }

    static get relationMappings() {
        const Payslip = require('./Payslip');
        const PayComponent = require('./PayComponent');
        return {
            payslip: {
                relation: AuditModel.BelongsToOneRelation,
                modelClass: Payslip,
                join: { from: 'payroll.payslip_lines.payslip_id', to: 'payroll.payslips.id' },
            },
            component: {
                relation: AuditModel.BelongsToOneRelation,
                modelClass: PayComponent,
                join: { from: 'payroll.payslip_lines.component_id', to: 'payroll.pay_components.id' },
            },
        };
    }
}

module.exports = PayslipLine;
