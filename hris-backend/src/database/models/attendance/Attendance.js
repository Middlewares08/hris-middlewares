// database/models/attendance/Attendance.js
const BaseModel = require('../BaseModel');

// 🎯 Fallback office cutoff (HH:mm, 24hr) used ONLY when a row is written without
// a resolved schedule. The normal path stamps `late_minutes` from the employee's
// work_schedule (see utils/attendanceScheduleStamp) and this is never consulted.
const LATE_CUTOFF = '09:15';

class Attendance extends BaseModel {
    static get tableName() { return 'attendance.attendance_logs'; }
    static get idColumn() { return 'id'; }

    // 🎯 Runs automatically right before a POST / insert operation hits the DB
    $beforeInsert(queryContext) {
        super.$beforeInsert(queryContext);
        this.created_at = new Date().toISOString();

        if (queryContext.user) {
            this.created_by = queryContext.user.id;
        }

        // 🎯 Must default here explicitly — relying on the DB column default means Objection
        // never sees 'present' on `this`, so applyLateStatus()'s guard below would always bail out
        if (!this.status) {
            this.status = 'present';
        }

        this.applyLateStatus();
    }

    // 🎯 Runs automatically right before a PUT / PATCH update operation hits the DB
    $beforeUpdate(opt, queryContext) {
        super.$beforeUpdate(opt, queryContext);
        this.updated_at = new Date().toISOString();

        if (queryContext.user) {
            this.updated_by = queryContext.user.id;
        }

        this.applyLateStatus();
    }

    // Reconcile `status` with lateness. An explicitly forced status
    // (on_leave / holiday / absent / half_day) is never overridden.
    applyLateStatus() {
        if (this.status && this.status !== 'present' && this.status !== 'late') return;

        // Schedule-aware stamping already derived late_minutes against the
        // employee's work_schedule — trust it.
        if (this.late_minutes !== undefined && this.late_minutes !== null) {
            this.status = Number(this.late_minutes) > 0 ? 'late' : (this.status || 'present');
            return;
        }

        // Fallback: no schedule context on this write — use the fixed office cutoff.
        if (!this.time_in) return;
        const clockIn = new Date(this.time_in);
        const hh = String(clockIn.getHours()).padStart(2, '0');
        const mm = String(clockIn.getMinutes()).padStart(2, '0');
        if (`${hh}:${mm}` > LATE_CUTOFF) {
            this.status = 'late';
        }
    }

    // Virtual: hours worked between time_in and time_out, rounded to 2 decimals
    $formatJson(json) {
        json = super.$formatJson(json);
        if (json.time_in && json.time_out) {
            const ms = new Date(json.time_out) - new Date(json.time_in);
            json.worked_hours = Math.round((ms / (1000 * 60 * 60)) * 100) / 100;
        } else {
            json.worked_hours = null;
        }
        return json;
    }

    static get relationMappings() {
        const Employee = require('../employee/Employee');

        return {
            employee: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Employee,
                join: {
                    from: 'attendance.attendance_logs.employee_id',
                    to: 'employee.employees.id'
                },
                modify: (builder) => builder.select('id', 'uuid', 'first_name', 'last_name')
            }
        };
    }
}

module.exports = Attendance;
