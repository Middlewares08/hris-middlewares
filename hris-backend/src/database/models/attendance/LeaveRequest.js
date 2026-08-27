// database/models/attendance/LeaveRequest.js
const BaseModel = require('../BaseModel');

const MS_PER_DAY = 1000 * 60 * 60 * 24;

class LeaveRequest extends BaseModel {
    static get tableName() { return 'attendance.leave_requests'; }
    static get idColumn() { return 'id'; }

    // 🎯 Runs automatically right before a POST / insert operation hits the DB
    $beforeInsert(queryContext) {
        super.$beforeInsert(queryContext);
        this.created_at = new Date().toISOString();

        if (queryContext.user) {
            this.created_by = queryContext.user.id;
        }

        if (!this.status) {
            this.status = 'pending';
        }

        this.total_days = LeaveRequest.computeTotalDays(this);
    }

    // 🎯 Runs automatically right before a PUT / PATCH update operation hits the DB.
    // total_days is recomputed by the controller (which holds the full pre/post span)
    // and passed in explicitly, so it is not derived here.
    $beforeUpdate(opt, queryContext) {
        super.$beforeUpdate(opt, queryContext);
        this.updated_at = new Date().toISOString();

        if (queryContext.user) {
            this.updated_by = queryContext.user.id;
        }
    }

    // Inclusive calendar-day span between start_date and end_date.
    // A flagged single-day request counts as 0.5.
    static computeTotalDays({ start_date, end_date, is_half_day }) {
        if (!start_date || !end_date) return 0;

        const start = new Date(`${String(start_date).substring(0, 10)}T00:00:00Z`);
        const end = new Date(`${String(end_date).substring(0, 10)}T00:00:00Z`);

        const spanDays = Math.floor((end - start) / MS_PER_DAY) + 1;
        if (spanDays <= 0) return 0;

        if (is_half_day && spanDays === 1) return 0.5;
        return spanDays;
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
                    from: 'attendance.leave_requests.employee_id',
                    to: 'employee.employees.id'
                },
                modify: employeeSummary
            },
            reviewer: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Employee,
                join: {
                    from: 'attendance.leave_requests.reviewed_by',
                    to: 'employee.employees.id'
                },
                modify: employeeSummary
            }
        };
    }
}

module.exports = LeaveRequest;
