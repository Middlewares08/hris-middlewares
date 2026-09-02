/**
 * Work-schedule resolver — the single place that answers:
 *   "what shift was this employee expected to work on date X, and how
 *    late / short were they against it?"
 *
 * Schedules are a weekly pattern (attendance.work_schedules + _days). An employee
 * is pointed at one through attendance.employee_schedule_assignments (effective-
 * dated), falling back to the org default schedule when unassigned.
 *
 * Time convention: start_time / end_time are wall-clock times in the server's
 * local zone (assumed Asia/Manila — the same assumption the old hard-coded 09:15
 * LATE_CUTOFF made). For a night shift (end_time <= start_time) the end rolls to
 * the next calendar day; a log's `log_date` is the date the shift STARTS.
 */
const WorkSchedule = require('../database/models/attendance/WorkSchedule');
const EmployeeScheduleAssignment = require('../database/models/attendance/EmployeeScheduleAssignment');
const Holiday = require('../database/models/attendance/Holiday');

/** Normalise to 'YYYY-MM-DD'. pg returns `date` columns as Date objects (local
 *  midnight), so string-slicing alone would mangle them. */
const ymd = (d) => {
    if (d instanceof Date) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return String(d || '').substring(0, 10);
};

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Server-local Date from 'YYYY-MM-DD' + 'HH:MM[:SS]', optionally shifted by N days. */
function atTime(dateStr, timeStr, addDays = 0) {
    const [y, m, d] = ymd(dateStr).split('-').map(Number);
    const [hh, mm, ss] = String(timeStr || '00:00:00').split(':').map(Number);
    return new Date(y, m - 1, d + addDays, hh || 0, mm || 0, ss || 0, 0);
}

/** 0=Sun … 6=Sat for a 'YYYY-MM-DD' string, in server-local time. */
function weekdayOf(dateStr) {
    const [y, m, d] = ymd(dateStr).split('-').map(Number);
    return new Date(y, m - 1, d).getDay();
}

/** Every 'YYYY-MM-DD' in [from, to] inclusive. */
function eachDate(from, to) {
    const out = [];
    const [y, m, d] = ymd(from).split('-').map(Number);
    const end = ymd(to);
    const cur = new Date(y, m - 1, d);
    for (;;) {
        const s = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
        if (s > end) break;
        out.push(s);
        cur.setDate(cur.getDate() + 1);
    }
    return out;
}

/**
 * @typedef {Object} ResolvedShift
 * @property {number|null} scheduleId
 * @property {string|null} scheduleName
 * @property {boolean} isWorkday        - false → rest day for this employee
 * @property {number}  graceMinutes
 * @property {number}  breakMinutes
 * @property {number}  halfDayHours
 * @property {Date|null} scheduledStart
 * @property {Date|null} scheduledEnd
 * @property {number}  scheduledHours   - net of the unpaid break
 * @property {boolean} crossesMidnight
 */

/** Shape a schedule + its weekday row into a resolved shift for `date`. */
function shapeShift(date, schedule, dayRow) {
    const shift = {
        scheduleId: schedule ? schedule.id : null,
        scheduleName: schedule ? schedule.name : null,
        graceMinutes: Number(schedule && schedule.grace_minutes) || 0,
        halfDayHours: Number(schedule && schedule.half_day_hours) || 4,
        breakMinutes: Number(dayRow && dayRow.break_minutes) || 0,
        isWorkday: !!(dayRow && dayRow.is_workday),
        scheduledStart: null,
        scheduledEnd: null,
        scheduledHours: 0,
        crossesMidnight: false,
    };

    if (!shift.isWorkday || !dayRow.start_time || !dayRow.end_time) return shift;

    const crosses = String(dayRow.end_time) <= String(dayRow.start_time);
    const start = atTime(date, dayRow.start_time);
    const end = atTime(date, dayRow.end_time, crosses ? 1 : 0);

    shift.crossesMidnight = crosses;
    shift.scheduledStart = start;
    shift.scheduledEnd = end;
    shift.scheduledHours = round2(Math.max(0, (end - start) / 3600000 - shift.breakMinutes / 60));
    return shift;
}

/**
 * Resolve the shift an employee was expected to work on `date` ('YYYY-MM-DD').
 * @returns {Promise<ResolvedShift>}
 */
async function resolveSchedule(trx, employeeId, date) {
    const day = ymd(date);
    const assignment = await EmployeeScheduleAssignment.activeForEmployee(employeeId, day, trx);

    let schedule = null;
    if (assignment) {
        schedule = await WorkSchedule.query(trx)
            .findById(assignment.schedule_id)
            .where('is_deleted', false)
            .withGraphFetched('days');
    }
    if (!schedule) schedule = await WorkSchedule.defaultSchedule(trx);

    const weekday = weekdayOf(day);
    const dayRow = (schedule && schedule.days && schedule.days.find((r) => Number(r.weekday) === weekday)) || null;
    return shapeShift(day, schedule, dayRow);
}

/**
 * Late / undertime / net worked-hours for a punch pair against a resolved shift.
 * Lateness counts from scheduled start once the grace window is blown (full
 * lateness, not just the overage past grace — matches the old cutoff behaviour).
 * Rest days and holidays produce zero late/undertime regardless of punch times.
 *
 * @param {ResolvedShift} shift
 * @param {string|Date|null} timeIn
 * @param {string|Date|null} timeOut
 * @param {{ isHoliday?: boolean }} [opts]
 */
function deriveTardiness(shift, timeIn, timeOut, opts = {}) {
    const out = { lateMinutes: 0, undertimeMinutes: 0, workedHours: null };
    const tIn = timeIn ? new Date(timeIn) : null;
    const tOut = timeOut ? new Date(timeOut) : null;
    const countable = shift.isWorkday && !opts.isHoliday;

    if (countable && shift.scheduledStart && tIn) {
        const graceCutoff = new Date(shift.scheduledStart.getTime() + shift.graceMinutes * 60000);
        if (tIn > graceCutoff) {
            out.lateMinutes = Math.max(0, Math.round((tIn - shift.scheduledStart) / 60000));
        }
    }
    if (countable && shift.scheduledEnd && tOut && tOut < shift.scheduledEnd) {
        out.undertimeMinutes = Math.max(0, Math.round((shift.scheduledEnd - tOut) / 60000));
    }
    if (tIn && tOut && tOut > tIn) {
        const gross = (tOut - tIn) / 3600000;
        const breakHrs = gross > shift.breakMinutes / 60 ? shift.breakMinutes / 60 : 0;
        out.workedHours = round2(Math.max(0, gross - breakHrs));
    }
    return out;
}

/** A non-working holiday on `date`, or undefined. */
function holidayOn(trx, date) {
    return Holiday.onDate(trx, date);
}

/**
 * The 'YYYY-MM-DD' dates each employee was scheduled to work across [from, to],
 * excluding non-working holidays. Set-based: a fixed number of queries
 * regardless of employee count. Returns Map<employeeId(number), string[]>.
 */
async function scheduledWorkdaysByEmployee(trx, employeeIds, from, to) {
    const ids = [...new Set((employeeIds || []).map(Number).filter(Boolean))];
    const result = new Map(ids.map((id) => [id, []]));
    if (!ids.length) return result;

    // Sequential — `trx` may be a knex transaction, which runs one query at a time.
    const assignments = await EmployeeScheduleAssignment.query(trx)
        .whereIn('employee_id', ids)
        .where('is_deleted', false)
        .where('effective_date', '<=', ymd(to))
        .where((b) => b.whereNull('end_date').orWhere('end_date', '>=', ymd(from)))
        .orderBy('effective_date', 'desc');
    const schedules = await WorkSchedule.query(trx).where('is_deleted', false).withGraphFetched('days');
    const defaultSchedule = await WorkSchedule.defaultSchedule(trx);
    const holidays = await Holiday.inRange(trx, ymd(from), ymd(to));

    const scheduleById = new Map(schedules.map((s) => [s.id, s]));
    const nonWorkingHolidays = new Set(
        holidays.filter((h) => h.type !== 'special_working').map((h) => ymd(h.date)),
    );
    const dates = eachDate(from, to).filter((d) => !nonWorkingHolidays.has(d));

    const assignmentsByEmp = new Map();
    for (const a of assignments) {
        if (!assignmentsByEmp.has(a.employee_id)) assignmentsByEmp.set(a.employee_id, []);
        assignmentsByEmp.get(a.employee_id).push(a); // already effective_date desc
    }

    for (const id of ids) {
        const empAssignments = assignmentsByEmp.get(id) || [];
        const workdays = [];
        for (const date of dates) {
            const match = empAssignments.find(
                (a) => ymd(a.effective_date) <= date && (!a.end_date || ymd(a.end_date) >= date),
            );
            const schedule = (match && scheduleById.get(match.schedule_id)) || defaultSchedule;
            if (!schedule || !schedule.days) continue;
            const weekday = weekdayOf(date);
            const dayRow = schedule.days.find((r) => Number(r.weekday) === weekday);
            if (dayRow && dayRow.is_workday) workdays.push(date);
        }
        result.set(id, workdays);
    }
    return result;
}

/**
 * How many days each employee was scheduled to work across [from, to], excluding
 * non-working holidays. Returns Map<employeeId(number), number>.
 */
async function expectedScheduledDays(trx, employeeIds, from, to) {
    const byEmp = await scheduledWorkdaysByEmployee(trx, employeeIds, from, to);
    return new Map([...byEmp].map(([id, dates]) => [id, dates.length]));
}

module.exports = {
    resolveSchedule,
    deriveTardiness,
    holidayOn,
    scheduledWorkdaysByEmployee,
    expectedScheduledDays,
    shapeShift,
    atTime,
    weekdayOf,
    eachDate,
    ymd,
};
