// database/models/payroll/StatutoryTable.js
const AuditModel = require('./AuditModel');

const TYPES = ['sss', 'philhealth', 'pagibig', 'withholding_tax'];
const FREQUENCIES = ['monthly', 'semi_monthly', 'annual'];
const COMPUTATION_TYPES = ['fixed_bracket', 'flat_percentage', 'tiered_percentage', 'tax_bracket'];

const NUMERIC = ['employee_rate', 'employer_rate', 'salary_floor', 'salary_ceiling', 'salary_rounding', 'ec_amount'];

class StatutoryTable extends AuditModel {
    static get tableName() { return 'payroll.statutory_tables'; }
    static get idColumn() { return 'id'; }

    static get TYPES() { return TYPES; }
    static get FREQUENCIES() { return FREQUENCIES; }
    static get COMPUTATION_TYPES() { return COMPUTATION_TYPES; }

    $parseDatabaseJson(json) {
        json = super.$parseDatabaseJson(json);
        for (const k of NUMERIC) {
            if (json[k] !== null && json[k] !== undefined) json[k] = Number(json[k]);
        }
        return json;
    }

    /**
     * Resolve the schedule of `type` in effect on `onDate` (YYYY-MM-DD), with its
     * bracket rows eager-loaded (ordered). Falls back to the most recent active row.
     */
    static async resolve(type, onDate, trx) {
        const date = String(onDate || '').substring(0, 10) || new Date().toISOString().substring(0, 10);

        const withBrackets = (q) => q
            .withGraphFetched('brackets')
            .modifyGraph('brackets', (b) => b.where('payroll.statutory_brackets.is_deleted', false).orderBy('sort_order', 'asc'));

        const windowed = await withBrackets(
            StatutoryTable.query(trx)
                .where({ type, is_deleted: false, is_active: true })
                .where('effective_from', '<=', date)
                .where((b) => b.whereNull('effective_to').orWhere('effective_to', '>=', date))
                .orderBy('effective_from', 'desc'),
        ).first();

        if (windowed) return windowed;

        return withBrackets(
            StatutoryTable.query(trx)
                .where({ type, is_deleted: false, is_active: true })
                .orderBy('effective_from', 'desc'),
        ).first();
    }

    static get relationMappings() {
        const StatutoryBracket = require('./StatutoryBracket');
        return {
            brackets: {
                relation: AuditModel.HasManyRelation,
                modelClass: StatutoryBracket,
                join: {
                    from: 'payroll.statutory_tables.id',
                    to: 'payroll.statutory_brackets.statutory_table_id',
                },
            },
        };
    }
}

module.exports = StatutoryTable;
