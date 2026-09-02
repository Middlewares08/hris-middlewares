/**
 * Bridges a raw attendance punch to the persisted schedule columns on
 * attendance.attendance_logs (schedule_id, scheduled_start/end/hours,
 * late_minutes, undertime_minutes, is_rest_day, is_holiday) — plus the derived
 * `status`.
 *
 * Everything that writes an attendance row (self-service clock in/out, the kiosk,
 * admin manual entry/edit, the auto-clock-out job, the backfill job) routes
 * through here so the schedule math lives in exactly one place.
 */
const Attendance = require('../database/models/attendance/Attendance');
const { resolveSchedule, deriveTardiness, holidayOn } = require('./workSchedule');

// Statuses an admin / another system deliberately set — the schedule math must
// preserve these rather than recompute a present/late/half_day value.
const FORCED_STATUSES = new Set(['on_leave', 'holiday', 'absent']);

/**
 * Resolve the schedule for one attendance day and return the column patch an
 * insert / update should carry. Pure read — never writes.
 *
 * @param {import('knex').Knex|import('knex').Knex.Transaction} trx
 * @param {{
 *   employeeId: number, logDate: string,
 *   timeIn?: string|Date|null, timeOut?: string|Date|null,
 *   forcedStatus?: string|null
 * }} args
 * @returns {Promise<object>} fields to merge into the payload (includes `status`)
 */
async function computeScheduleStamp(trx, {
    employeeId, logDate, timeIn = null, timeOut = null, forcedStatus = null,
}) {
    const shift = await resolveSchedule(trx, employeeId, logDate);
    const isHoliday = !!(await holidayOn(trx, logDate));

    const { lateMinutes, undertimeMinutes, workedHours } =
        deriveTardiness(shift, timeIn, timeOut, { isHoliday });

    const patch = {
        schedule_id: shift.scheduleId,
        scheduled_start: shift.scheduledStart ? shift.scheduledStart.toISOString() : null,
        scheduled_end: shift.scheduledEnd ? shift.scheduledEnd.toISOString() : null,
        scheduled_hours: shift.isWorkday ? shift.scheduledHours : 0,
        late_minutes: lateMinutes,
        undertime_minutes: undertimeMinutes,
        is_rest_day: !shift.isWorkday,
        is_holiday: isHoliday,
    };

    if (forcedStatus && forcedStatus !== 'present') {
        patch.status = forcedStatus; // caller knows best (leave / holiday / manual)
    } else if (!timeIn) {
        patch.status = 'present';
    } else if (timeIn && timeOut && workedHours != null
        && shift.isWorkday && !isHoliday && workedHours < shift.halfDayHours) {
        patch.status = 'half_day';
    } else if (lateMinutes > 0) {
        patch.status = 'late';
    } else {
        patch.status = 'present';
    }

    return patch;
}

/**
 * Recompute + persist the schedule columns for an existing log id. Used by the
 * admin edit path, the auto-clock-out job and the one-off backfill. Keeps a
 * forced status (on_leave / holiday / absent) intact.
 *
 * @param {import('knex').Knex|import('knex').Knex.Transaction} trx
 */
async function restampLog(trx, logId, { actorId = null } = {}) {
    const log = await Attendance.query(trx).findById(logId);
    if (!log || log.is_deleted) return null;

    const patch = await computeScheduleStamp(trx, {
        employeeId: log.employee_id,
        logDate: log.log_date,
        timeIn: log.time_in,
        timeOut: log.time_out,
        forcedStatus: FORCED_STATUSES.has(log.status) ? log.status : null,
    });
    if (actorId) patch.updated_by = actorId;

    return Attendance.query(trx).patchAndFetchById(logId, patch);
}

module.exports = { computeScheduleStamp, restampLog, FORCED_STATUSES };
