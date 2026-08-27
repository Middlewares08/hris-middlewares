// database/models/payroll/StatutoryBracket.js
const AuditModel = require('./AuditModel');

const NUMERIC = [
    'lower_bound', 'upper_bound', 'employee_amount', 'employer_amount', 'ec_amount',
    'employee_rate', 'employer_rate', 'base_tax', 'tax_rate',
];

class StatutoryBracket extends AuditModel {
    static get tableName() { return 'payroll.statutory_brackets'; }
    static get idColumn() { return 'id'; }

    $parseDatabaseJson(json) {
        json = super.$parseDatabaseJson(json);
        for (const k of NUMERIC) {
            if (json[k] !== null && json[k] !== undefined) json[k] = Number(json[k]);
        }
        return json;
    }

    static get relationMappings() {
        const StatutoryTable = require('./StatutoryTable');
        return {
            table: {
                relation: AuditModel.BelongsToOneRelation,
                modelClass: StatutoryTable,
                join: {
                    from: 'payroll.statutory_brackets.statutory_table_id',
                    to: 'payroll.statutory_tables.id',
                },
            },
        };
    }
}

module.exports = StatutoryBracket;
