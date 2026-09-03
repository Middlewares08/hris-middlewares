const Attendance = require('../../database/models/attendance/Attendance');
const { computeScheduleStamp } = require('../../utils/attendanceScheduleStamp');

// One-off: stamp the schedule columns on attendance rows written before the work
// schedule module existed. Manual only —
//   npm run job backfillSchedule
// Idempotent: re-running only touches rows still missing schedule_id, so it is
// safe to run again if it was interrupted or new legacy rows surface.
//
// BACKFILL_SCHEDULE_LIMIT caps how many rows one run processes (default 5000) so
// a huge history can be chipped away at across several runs.
const BATCH_LIMIT = Number(process.env.BACKFILL_SCHEDULE_LIMIT) || 5000;

/**
 * @param {import('knex').Knex.Transaction} trx
 */
async function backfillSchedule(trx) {
    const rows = await Attendance.query(trx)
        .where('is_deleted', false)
        .whereNull('schedule_id')
        .orderBy('log_date', 'asc')
        .limit(BATCH_LIMIT);

    let stamped = 0;
    let restDay = 0;
    let holiday = 0;

    for (const row of rows) {
        const patch = await computeScheduleStamp(trx, {
            employeeId: row.employee_id,
            logDate: row.log_date,
            timeIn: row.time_in,
            timeOut: row.time_out,
            // Never overwrite a status an admin explicitly set on a legacy row.
            forcedStatus: ['on_leave', 'holiday', 'absent'].includes(row.status) ? row.status : null,
        });

        await Attendance.query(trx).patchAndFetchById(row.id, patch);
        stamped += 1;
        if (patch.is_rest_day) restDay += 1;
        if (patch.is_holiday) holiday += 1;
    }

    const remaining = await Attendance.query(trx)
        .where('is_deleted', false)
        .whereNull('schedule_id')
        .resultSize();

    return { scanned: rows.length, stamped, restDay, holiday, remaining };
}

module.exports = backfillSchedule;
