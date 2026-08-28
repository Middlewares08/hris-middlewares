// database/models/attendance/OvertimeRequest.js
const BaseModel = require('../BaseModel');

const STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];

class OvertimeRequest extends BaseModel {
    static get tableName() { return 'attendance.overtime_requests'; }
    static get idColumn() { return 'id'; }

    static get STATUSES() { return STATUSES; }

    $beforeInsert(queryContext) {
        super.$beforeInsert(queryContext);
        this.created_at = new Date().toISOString();
        if (queryContext.user) this.created_by = queryContext.user.id;
        if (!this.status) this.status = 'pending';
    }

    $beforeUpdate(opt, queryContext) {
        super.$beforeUpdate(opt, queryContext);
        this.updated_at = new Date().toISOString();
        if (queryContext.user) this.updated_by = queryContext.user.id;
    }

    /**
     * Sum of APPROVED overtime hours for an employee whose work_date falls inside
     * [start, end] (inclusive, 'YYYY-MM-DD'). Used by the payroll engine.
     */
    static async approvedHoursForPeriod(trx, employeeId, start, end) {
        const row = await OvertimeRequest.query(trx)
            .where('employee_id', employeeId)
            .where('is_deleted', false)
            .where('status', 'approved')
            .where('work_date', '>=', start)
            .where('work_date', '<=', end)
            .sum('hours as total')
            .first();
        return Number(row?.total) || 0;
    }

    static get relationMappings() {
        const Employee = require('../employee/Employee');

        const employeeSummary = (builder) =>
            builder.select('id', 'uuid', 'first_name', 'last_name');

        return {
            employee: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Employee,
                join: {
                    from: 'attendance.overtime_requests.employee_id',
                    to: 'employee.employees.id',
                },
                modify: employeeSummary,
            },
            reviewer: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Employee,
                join: {
                    from: 'attendance.overtime_requests.reviewed_by',
                    to: 'employee.employees.id',
                },
                modify: employeeSummary,
            },
        };
    }
}

module.exports = OvertimeRequest;
