const Attendance = require('../database/models/attendance/Attendance');
const { logActivity } = require('./activityLogger');

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
        const log = await Attendance.query()
            .context({ user: actorId ? { id: actorId } : undefined })
            .insertAndFetch({
                employee_id: employeeId,
                log_date: logDate,
                time_in: new Date().toISOString(),
                source,
                created_by: actorId,
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

    const log = await Attendance.query()
        .context({ user: actorId ? { id: actorId } : undefined })
        .patchAndFetchById(existing.id, {
            time_out: new Date().toISOString(),
            updated_by: actorId,
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
