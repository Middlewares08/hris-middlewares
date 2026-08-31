// database/models/payroll/EmployeeCompensation.js
const AuditModel = require('./AuditModel');

const RATE_TYPES = ['monthly', 'semi_monthly', 'daily', 'hourly'];
const PAY_FREQUENCIES = ['monthly', 'semi_monthly', 'weekly', 'bi_weekly'];
const PAYMENT_METHODS = ['bank_transfer', 'cash', 'check'];

class EmployeeCompensation extends AuditModel {
    static get tableName() { return 'payroll.employee_compensations'; }
    static get idColumn() { return 'id'; }

    static get RATE_TYPES() { return RATE_TYPES; }
    static get PAY_FREQUENCIES() { return PAY_FREQUENCIES; }
    static get PAYMENT_METHODS() { return PAYMENT_METHODS; }

    /**
     * Derive a normalized monthly basic from a rate + type, so statutory
     * contributions always compute against a consistent figure.
     */
    static deriveMonthlyEquivalent({ pay_rate, rate_type, working_days_per_month = 22, working_hours_per_day = 8 }) {
        const rate = Number(pay_rate) || 0;
        const days = Number(working_days_per_month) || 22;
        const hours = Number(working_hours_per_day) || 8;

        switch (rate_type) {
            case 'daily': return round2(rate * days);
            case 'hourly': return round2(rate * hours * days);
            case 'semi_monthly': return round2(rate * 2);
            case 'monthly':
            default: return round2(rate);
        }
    }

    /**
     * Upsert the single active compensation row for an employee, superseding the
     * current one (closes it the day before the new effective date). Mirrors the
     * logic in EmployeeCompensationController.create so the employee create/edit
     * flow can set pay in one place. Runs entirely on the supplied transaction.
     */
    static async setActive(trx, {
        employeeId,
        pay_rate,
        rate_type = 'monthly',
        effective_date,
        working_days_per_month = 22,
        working_hours_per_day = 8,
        pay_frequency = 'semi_monthly',
        actorId = null,
    }) {
        const effDate = String(effective_date || '').substring(0, 10) || new Date().toISOString().substring(0, 10);
        const type = RATE_TYPES.includes(rate_type) ? rate_type : 'monthly';

        await EmployeeCompensation.query(trx)
            .patch({
                is_active: false,
                end_date: EmployeeCompensation.raw('LEAST(COALESCE(end_date, ?::date - 1), ?::date - 1)', [effDate, effDate]),
                updated_by: actorId,
            })
            .where({ employee_id: employeeId, is_active: true, is_deleted: false });

        return EmployeeCompensation.query(trx).insertAndFetch({
            employee_id: employeeId,
            pay_rate: Number(pay_rate) || 0,
            rate_type: type,
            monthly_equivalent: EmployeeCompensation.deriveMonthlyEquivalent({
                pay_rate, rate_type: type,
                working_days_per_month, working_hours_per_day,
            }),
            working_days_per_month,
            working_hours_per_day,
            pay_frequency,
            currency: 'PHP',
            payment_method: 'bank_transfer',
            effective_date: effDate,
            is_active: true,
            created_by: actorId,
        });
    }

    /** The active compensation for an employee as of `onDate`. */
    static activeForEmployee(employeeId, onDate, trx) {
        const date = String(onDate || '').substring(0, 10) || new Date().toISOString().substring(0, 10);
        return EmployeeCompensation.query(trx)
            .where({ employee_id: employeeId, is_deleted: false, is_active: true })
            .where('effective_date', '<=', date)
            .where((b) => b.whereNull('end_date').orWhere('end_date', '>=', date))
            .orderBy('effective_date', 'desc')
            .first();
    }

    static get relationMappings() {
        const Employee = require('../employee/Employee');
        return {
            employee: {
                relation: AuditModel.BelongsToOneRelation,
                modelClass: Employee,
                join: {
                    from: 'payroll.employee_compensations.employee_id',
                    to: 'employee.employees.id',
                },
                modify: (b) => b.select('id', 'uuid', 'first_name', 'last_name'),
            },
        };
    }
}

function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

module.exports = EmployeeCompensation;
