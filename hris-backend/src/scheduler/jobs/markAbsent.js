const Attendance = require('../../database/models/attendance/Attendance');
const Employee = require('../../database/models/employee/Employee');
const LeaveRequest = require('../../database/models/attendance/LeaveRequest');
const Holiday = require('../../database/models/attendance/Holiday');
const { resolveSchedule, eachDate } = require('../../utils/workSchedule');
const { logActivity } = require('../../utils/activityLogger');

// How many days back the job fills each night. A trailing window (not just
// yesterday) means a weekend of worker downtime still gets reconciled.
const BACKFILL_DAYS = Number(process.env.ABSENT_BACKFILL_DAYS) || 3;

const ymdLocal = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const clip = (v) => String(v || '').substring(0, 10);

/**
 * Create the attendance rows a missing punch would otherwise leave as a silent
 * gap: for every scheduled workday in the trailing window that an active
 * employee has no log for, insert
 *   - `on_leave` when an approved leave covers the day, else
 *   - `absent`.
 *
 * Non-working holidays and rest days are skipped. Today is skipped (the shift may
 * not be over yet). Idempotent — the (employee_id, log_date) unique key plus the
 * pre-scan of existing rows mean a re-run inserts nothing new.
 *
 * @param {import('knex').Knex.Transaction} trx
 */
async function markAbsent(trx) {
    const now = new Date();
    const to = new Date(now); to.setDate(to.getDate() - 1);            // yesterday
    const from = new Date(now); from.setDate(from.getDate() - BACKFILL_DAYS);
    const fromYmd = ymdLocal(from);
    const toYmd = ymdLocal(to);
    if (fromYmd > toYmd) return { window: null, insertedAbsent: 0, insertedLeave: 0 };

    const dates = eachDate(fromYmd, toYmd);

    // Sequential, not Promise.all — a knex transaction runs one query at a time.
    const employees = await Employee.query(trx)
        .where({ is_deleted: false, is_active: true })
        .select('id', 'date_hired');
    const existingLogs = await Attendance.query(trx)
        .where('is_deleted', false)
        .where('log_date', '>=', fromYmd)
        .where('log_date', '<=', toYmd)
        .select('employee_id', 'log_date');
    const leaves = await LeaveRequest.query(trx)
        .where('is_deleted', false)
        .where('status', 'approved')
        .where('start_date', '<=', toYmd)
        .where('end_date', '>=', fromYmd)
        .select('employee_id', 'start_date', 'end_date');
    const holidays = await Holiday.inRange(trx, fromYmd, toYmd);

    const haveLog = new Set(existingLogs.map((r) => `${r.employee_id}|${clip(r.log_date)}`));
    const nonWorkingHoliday = new Set(
        holidays.filter((h) => h.type !== 'special_working').map((h) => clip(h.date)),
    );
    const coveredByLeave = (empId, date) => leaves.some((l) =>
        l.employee_id === empId && clip(l.start_date) <= date && clip(l.end_date) >= date);

    let insertedAbsent = 0;
    let insertedLeave = 0;

    for (const emp of employees) {
        const hiredOn = emp.date_hired ? clip(emp.date_hired) : null;

        for (const date of dates) {
            if (haveLog.has(`${emp.id}|${date}`)) continue;
            if (nonWorkingHoliday.has(date)) continue;
            if (hiredOn && hiredOn > date) continue; // not employed yet

            const shift = await resolveSchedule(trx, emp.id, date);
            if (!shift.isWorkday) continue; // rest day for this employee

            const onLeave = coveredByLeave(emp.id, date);
            const status = onLeave ? 'on_leave' : 'absent';

            await Attendance.query(trx).insert({
                employee_id: emp.id,
                log_date: date,
                status,
                source: 'manual',
                schedule_id: shift.scheduleId,
                scheduled_start: shift.scheduledStart ? shift.scheduledStart.toISOString() : null,
                scheduled_end: shift.scheduledEnd ? shift.scheduledEnd.toISOString() : null,
                scheduled_hours: shift.scheduledHours,
                is_rest_day: false,
                is_holiday: false,
                remarks: onLeave
                    ? 'Auto: covered by approved leave'
                    : 'Auto: no attendance recorded on a scheduled workday',
            });

            if (onLeave) insertedLeave += 1; else insertedAbsent += 1;

            await logActivity({
                employeeId: emp.id,
                action: onLeave ? 'attendance.auto_on_leave' : 'attendance.auto_absent',
                category: 'attendance',
                description: `System marked ${date} as ${status} (no punch on a scheduled workday)`,
                metadata: { log_date: date, schedule_id: shift.scheduleId },
            }, trx);
        }
    }

    return {
        window: `${fromYmd}..${toYmd}`,
        employees: employees.length,
        insertedAbsent,
        insertedLeave,
    };
}

module.exports = markAbsent;
