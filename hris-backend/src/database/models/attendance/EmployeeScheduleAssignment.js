// database/models/attendance/EmployeeScheduleAssignment.js
const BaseModel = require('../BaseModel');

// Effective-dated link from an employee to a work_schedule. Mirrors the
// supersede-the-current-row pattern in payroll.employee_compensations so the
// employee create/edit flow can set a schedule in one place.
class EmployeeScheduleAssignment extends BaseModel {
    static get tableName() { return 'attendance.employee_schedule_assignments'; }
    static get idColumn() { return 'id'; }

    $beforeInsert(queryContext) {
        super.$beforeInsert(queryContext);
        this.created_at = new Date().toISOString();
        if (queryContext.user) this.created_by = queryContext.user.id;
    }

    $beforeUpdate(opt, queryContext) {
        super.$beforeUpdate(opt, queryContext);
        this.updated_at = new Date().toISOString();
        if (queryContext.user) this.updated_by = queryContext.user.id;
    }

    /**
     * Point the employee at `scheduleId` from `effective_date` onward, closing the
     * current open assignment the day before. Runs on the supplied transaction.
     */
    static async setActive(trx, { employeeId, scheduleId, effective_date, actorId = null }) {
        const effDate = String(effective_date || '').substring(0, 10)
            || new Date().toISOString().substring(0, 10);

        await EmployeeScheduleAssignment.query(trx)
            .patch({
                is_active: false,
                end_date: EmployeeScheduleAssignment.raw(
                    'LEAST(COALESCE(end_date, ?::date - 1), ?::date - 1)',
                    [effDate, effDate],
                ),
                updated_by: actorId,
            })
            .where({ employee_id: employeeId, is_active: true, is_deleted: false });

        return EmployeeScheduleAssignment.query(trx).insertAndFetch({
            employee_id: employeeId,
            schedule_id: scheduleId,
            effective_date: effDate,
            is_active: true,
            created_by: actorId,
        });
    }

    /**
     * The assignment governing `onDate` — resolved by date range, not the
     * is_active flag, so historical / backfill lookups stay correct. Returns null
     * when the employee has never been assigned (caller falls back to the default
     * schedule).
     */
    static activeForEmployee(employeeId, onDate, trx) {
        const date = String(onDate || '').substring(0, 10)
            || new Date().toISOString().substring(0, 10);
        return EmployeeScheduleAssignment.query(trx)
            .where({ employee_id: employeeId, is_deleted: false })
            .where('effective_date', '<=', date)
            .where((b) => b.whereNull('end_date').orWhere('end_date', '>=', date))
            .orderBy('effective_date', 'desc')
            .first();
    }

    static get relationMappings() {
        const Employee = require('../employee/Employee');
        const WorkSchedule = require('./WorkSchedule');

        return {
            employee: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Employee,
                join: {
                    from: 'attendance.employee_schedule_assignments.employee_id',
                    to: 'employee.employees.id',
                },
                modify: (b) => b.select('id', 'uuid', 'first_name', 'last_name'),
            },
            schedule: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: WorkSchedule,
                join: {
                    from: 'attendance.employee_schedule_assignments.schedule_id',
                    to: 'attendance.work_schedules.id',
                },
            },
        };
    }
}

module.exports = EmployeeScheduleAssignment;
