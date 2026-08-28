const Attendance = require('../../database/models/attendance/Attendance');
const { logActivity } = require('../../utils/activityLogger');

// How many hours to credit an employee who forgot to clock out.
const STANDARD_WORKDAY_HOURS = Number(process.env.STANDARD_WORKDAY_HOURS) || 9;

// Safety window — never touch a punch younger than this. Keeps the job from
// cutting off someone genuinely still on the clock (long day, night shift that
// crosses midnight, etc.). Only clearly-forgotten punches get closed.
const MIN_OPEN_HOURS = Number(process.env.AUTO_CLOCK_OUT_MIN_OPEN_HOURS) || 16;

const AUTO_REMARK = `Auto clock-out: no time-out recorded (capped at ${STANDARD_WORKDAY_HOURS}h)`;

/**
 * Closes out attendance rows where the employee clocked in but never clocked out.
 * `time_out` is stamped at `time_in + STANDARD_WORKDAY_HOURS` and the row is
 * flagged `is_auto_closed` so a manager can review / correct it.
 *
 * Idempotent: the `time_out IS NULL` + `is_auto_closed = false` filter means a
 * re-run (or a crash mid-batch) never double-processes a row.
 *
 * @param {import('knex').Knex.Transaction} trx
 */
async function autoClockOut(trx) {
    const cutoffIso = new Date(Date.now() - MIN_OPEN_HOURS * 3600 * 1000).toISOString();

    const openLogs = await Attendance.query(trx)
        .where('is_deleted', false)
        .where('is_auto_closed', false)
        .whereNotNull('time_in')
        .whereNull('time_out')
        .where('time_in', '<', cutoffIso);

    let closed = 0;

    for (const row of openLogs) {
        const timeOut = new Date(
            new Date(row.time_in).getTime() + STANDARD_WORKDAY_HOURS * 3600 * 1000,
        ).toISOString();

        await Attendance.query(trx).patchAndFetchById(row.id, {
            time_out: timeOut,
            is_auto_closed: true,
            remarks: row.remarks ? `${row.remarks} | ${AUTO_REMARK}` : AUTO_REMARK,
        });

        await logActivity({
            employeeId: row.employee_id,
            action: 'attendance.auto_clock_out',
            category: 'attendance',
            description: `System auto clock-out for ${row.log_date} (capped at ${STANDARD_WORKDAY_HOURS}h)`,
            metadata: {
                attendance_uuid: row.uuid,
                log_date: row.log_date,
                time_in: row.time_in,
                time_out: timeOut,
                capped_hours: STANDARD_WORKDAY_HOURS,
            },
        }, trx);

        closed += 1;
    }

    return { scanned: openLogs.length, closed };
}

module.exports = autoClockOut;
