const Attendance = require('../database/models/attendance/Attendance');
const { logActivity } = require('./activityLogger');
const { computeScheduleStamp, FORCED_STATUSES } = require('./attendanceScheduleStamp');

const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const today = () => new Date().toISOString().substring(0, 10);

/**
 * Resolve and apply a clock in/out for an already-identified employee.
 *
 * Unlike the self-service `/attendance/clock-in|out` endpoints (one fixed action
 * each), the kiosk doesn't know which way to punch — this figures it out from
 * today's log:
 *   - no log      → clock in
 *   - open log    → clock out
 *   - closed log  → { ok:false, code:'DONE_FOR_DAY' }
 *
 * @param {{ employeeId:number, actorId?:number|null, source?:string, faceMeta?:object, req?:import('express').Request }} args
 * @returns {Promise<{ ok:true, action:'in'|'out', log:object } | { ok:false, code:'DONE_FOR_DAY', log:object }>}
 */
async function punchByEmployee({ employeeId, actorId = null, source = 'kiosk', faceMeta = {}, req }) {
    const logDate = today();
    const existing = await Attendance.query()
        .findOne({ employee_id: employeeId, log_date: logDate, is_deleted: false });

    if (existing && existing.time_out) {
        return { ok: false, code: 'DONE_FOR_DAY', log: existing };
    }

    if (!existing) {
        const timeIn = new Date().toISOString();
        const stamp = await computeScheduleStamp(Attendance.knex(), {
            employeeId, logDate, timeIn, timeOut: null,
        });

        const log = await Attendance.query()
            .context({ user: actorId ? { id: actorId } : undefined })
            .insertAndFetch({
                employee_id: employeeId,
                log_date: logDate,
                time_in: timeIn,
                source,
                created_by: actorId,
                ...stamp,
            });

        await logActivity({
            employeeId,
            action: 'attendance.clock_in',
            category: 'attendance',
            description: `Clocked in at ${formatTime(log.time_in)}`,
            metadata: { attendance_uuid: log.uuid, log_date: logDate, status: log.status, source, ...faceMeta },
            req,
        });

        return { ok: true, action: 'in', log };
    }

    const timeOut = new Date().toISOString();
    const stamp = await computeScheduleStamp(Attendance.knex(), {
        employeeId, logDate, timeIn: existing.time_in, timeOut,
        forcedStatus: FORCED_STATUSES.has(existing.status) ? existing.status : null,
    });

    const log = await Attendance.query()
        .context({ user: actorId ? { id: actorId } : undefined })
        .patchAndFetchById(existing.id, {
            time_out: timeOut,
            updated_by: actorId,
            ...stamp,
        });

    await logActivity({
        employeeId,
        action: 'attendance.clock_out',
        category: 'attendance',
        description: `Clocked out at ${formatTime(log.time_out)}`,
        metadata: { attendance_uuid: log.uuid, log_date: logDate, worked_hours: log.worked_hours, source, ...faceMeta },
        req,
    });

    return { ok: true, action: 'out', log };
}

module.exports = { punchByEmployee, formatTime };
