// database/models/payroll/PayComponent.js
const AuditModel = require('./AuditModel');

const COMPONENT_TYPES = ['earning', 'deduction', 'employer_contribution'];
const CALCULATION_TYPES = [
    'fixed', 'hourly_rate', 'daily_rate', 'percentage_of_basic',
    'percentage_of_gross', 'formula', 'statutory', 'manual',
];

class PayComponent extends AuditModel {
    static get tableName() { return 'payroll.pay_components'; }
    static get idColumn() { return 'id'; }

    static get COMPONENT_TYPES() { return COMPONENT_TYPES; }
    static get CALCULATION_TYPES() { return CALCULATION_TYPES; }

    static get jsonAttributes() { return ['metadata']; }

    $beforeInsert(queryContext) {
        super.$beforeInsert(queryContext);
        if (this.code) this.code = String(this.code).trim().toUpperCase();
    }

    $beforeUpdate(opt, queryContext) {
        super.$beforeUpdate(opt, queryContext);
        if (this.code) this.code = String(this.code).trim().toUpperCase();
    }

    static get relationMappings() {
        const EmployeeComponentAssignment = require('./EmployeeComponentAssignment');
        return {
            assignments: {
                relation: AuditModel.HasManyRelation,
                modelClass: EmployeeComponentAssignment,
                join: {
                    from: 'payroll.pay_components.id',
                    to: 'payroll.employee_component_assignments.component_id',
                },
            },
        };
    }
}

module.exports = PayComponent;
