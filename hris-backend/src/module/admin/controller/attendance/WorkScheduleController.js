const WorkSchedule = require('../../../../database/models/attendance/WorkSchedule');
const WorkScheduleDay = require('../../../../database/models/attendance/WorkScheduleDay');
const EmployeeScheduleAssignment = require('../../../../database/models/attendance/EmployeeScheduleAssignment');
const Employee = require('../../../../database/models/employee/Employee');
const { logActivity } = require('../../../../utils/activityLogger');

const actorId = (req) => (req.user?.id ? parseInt(req.user.id, 10) : null);

const HHMM = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/** Coerce the incoming `days` array into exactly 7 clean rows (weekday 0–6). */
const normalizeDays = (days) => {
    const byWeekday = new Map();
    for (const d of Array.isArray(days) ? days : []) {
        const wd = Number(d.weekday);
        if (!Number.isInteger(wd) || wd < 0 || wd > 6) continue;
        const isWorkday = !!d.is_workday;
        const start = isWorkday && HHMM.test(String(d.start_time || '')) ? String(d.start_time).slice(0, 8) : null;
        const end = isWorkday && HHMM.test(String(d.end_time || '')) ? String(d.end_time).slice(0, 8) : null;
        byWeekday.set(wd, {
            weekday: wd,
            is_workday: isWorkday && !!start && !!end,
            start_time: start,
            end_time: end,
            break_minutes: Number.isFinite(Number(d.break_minutes)) ? Math.max(0, Math.round(Number(d.break_minutes))) : 60,
        });
    }
    const out = [];
    for (let wd = 0; wd <= 6; wd += 1) {
        out.push(byWeekday.get(wd) || {
            weekday: wd, is_workday: false, start_time: null, end_time: null, break_minutes: 60,
        });
    }
    return out;
};

const validate = (body, { partial = false } = {}) => {
    if (!partial || body.name !== undefined) {
        if (!String(body.name || '').trim()) return 'name is required.';
    }
    if (body.grace_minutes !== undefined) {
        const g = Number(body.grace_minutes);
        if (!Number.isFinite(g) || g < 0 || g > 240) return 'grace_minutes must be between 0 and 240.';
    }
    if (body.half_day_hours !== undefined) {
        const h = Number(body.half_day_hours);
        if (!Number.isFinite(h) || h < 0 || h > 24) return 'half_day_hours must be between 0 and 24.';
    }
    return null;
};

/* ------------------------------------------------------------------ *
 * List / read
 * ------------------------------------------------------------------ */
const list = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const offset = (page - 1) * limit;
        const { search } = req.query;

        let query = WorkSchedule.query().where('is_deleted', false).withGraphFetched('days');
        if (search) {
            query = query.where((b) => b.where('name', 'ilike', `%${search}%`).orWhere('description', 'ilike', `%${search}%`));
        }

        const result = await query
            .orderBy('is_default', 'desc')
            .orderBy('name', 'asc')
            .range(offset, offset + limit - 1);

        return res.status(200).json({
            success: true,
            data: result.results,
            pagination: {
                totalRecords: result.total,
                currentPage: page,
                recordsPerPage: limit,
                totalPages: Math.ceil(result.total / limit),
            },
        });
    } catch (error) {
        console.error('WorkSchedule list error:', error);
        return res.status(500).json({ success: false, message: 'Server error retrieving work schedules.' });
    }
};

/** Un-paginated list for dropdowns / assignment pickers. */
const listAll = async (_req, res) => {
    try {
        const rows = await WorkSchedule.query()
            .where({ is_deleted: false, is_active: true })
            .withGraphFetched('days')
            .orderBy('is_default', 'desc')
            .orderBy('name', 'asc');
        return res.status(200).json({ success: true, data: rows });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getByUuid = async (req, res) => {
    try {
        const row = await WorkSchedule.query()
            .findOne({ uuid: req.params.uuid })
            .where('is_deleted', false)
            .withGraphFetched('days');
        if (!row) return res.status(404).json({ success: false, message: 'Work schedule not found.' });
        return res.status(200).json({ success: true, data: row });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/* ------------------------------------------------------------------ *
 * Create / update / delete
 * ------------------------------------------------------------------ */
const create = async (req, res) => {
    try {
        const err = validate(req.body);
        if (err) return res.status(400).json({ success: false, message: err });

        const days = normalizeDays(req.body.days);
        const makeDefault = !!req.body.is_default;

        const row = await WorkSchedule.transaction(async (trx) => {
            if (makeDefault) {
                await WorkSchedule.query(trx)
                    .patch({ is_default: false, updated_by: actorId(req) })
                    .where({ is_default: true, is_deleted: false });
            }

            const schedule = await WorkSchedule.query(trx)
                .context({ user: { id: actorId(req) } })
                .insertAndFetch({
                    name: String(req.body.name).trim(),
                    description: req.body.description ? String(req.body.description).trim() : null,
                    grace_minutes: req.body.grace_minutes !== undefined ? Math.round(Number(req.body.grace_minutes)) : 0,
                    half_day_hours: req.body.half_day_hours !== undefined ? Number(req.body.half_day_hours) : 4,
                    is_default: makeDefault,
                    is_active: req.body.is_active === undefined ? true : !!req.body.is_active,
                });

            await WorkScheduleDay.query(trx).insert(days.map((d) => ({ ...d, schedule_id: schedule.id })));
            return WorkSchedule.query(trx).findById(schedule.id).withGraphFetched('days');
        });

        await logActivity({
            employeeId: actorId(req),
            action: 'work_schedule.created',
            category: 'attendance',
            description: `Work schedule "${row.name}" created`,
            metadata: { schedule_uuid: row.uuid },
            req,
        });

        return res.status(201).json({ success: true, data: row });
    } catch (error) {
        console.error('WorkSchedule create error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const update = async (req, res) => {
    try {
        const err = validate(req.body, { partial: true });
        if (err) return res.status(400).json({ success: false, message: err });

        const existing = await WorkSchedule.query().findOne({ uuid: req.params.uuid }).where('is_deleted', false);
        if (!existing) return res.status(404).json({ success: false, message: 'Work schedule not found.' });

        const makeDefault = req.body.is_default === undefined ? existing.is_default : !!req.body.is_default;

        const row = await WorkSchedule.transaction(async (trx) => {
            if (makeDefault && !existing.is_default) {
                await WorkSchedule.query(trx)
                    .patch({ is_default: false, updated_by: actorId(req) })
                    .where({ is_default: true, is_deleted: false });
            }

            const patch = { updated_by: actorId(req) };
            if (req.body.name !== undefined) patch.name = String(req.body.name).trim();
            if (req.body.description !== undefined) patch.description = req.body.description ? String(req.body.description).trim() : null;
            if (req.body.grace_minutes !== undefined) patch.grace_minutes = Math.round(Number(req.body.grace_minutes));
            if (req.body.half_day_hours !== undefined) patch.half_day_hours = Number(req.body.half_day_hours);
            if (req.body.is_active !== undefined) patch.is_active = !!req.body.is_active;
            patch.is_default = makeDefault;

            await WorkSchedule.query(trx).context({ user: { id: actorId(req) } }).patchAndFetchById(existing.id, patch);

            if (req.body.days !== undefined) {
                const days = normalizeDays(req.body.days);
                await WorkScheduleDay.query(trx).delete().where('schedule_id', existing.id);
                await WorkScheduleDay.query(trx).insert(days.map((d) => ({ ...d, schedule_id: existing.id })));
            }

            return WorkSchedule.query(trx).findById(existing.id).withGraphFetched('days');
        });

        await logActivity({
            employeeId: actorId(req),
            action: 'work_schedule.updated',
            category: 'attendance',
            description: `Work schedule "${row.name}" updated`,
            metadata: { schedule_uuid: row.uuid },
            req,
        });

        return res.status(200).json({ success: true, data: row });
    } catch (error) {
        console.error('WorkSchedule update error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const remove = async (req, res) => {
    try {
        const existing = await WorkSchedule.query().findOne({ uuid: req.params.uuid }).where('is_deleted', false);
        if (!existing) return res.status(404).json({ success: false, message: 'Work schedule not found.' });
        if (existing.is_default) {
            return res.status(400).json({ success: false, message: 'The default schedule cannot be deleted. Set another schedule as default first.' });
        }

        await WorkSchedule.query()
            .context({ user: { id: actorId(req) } })
            .patchAndFetchById(existing.id, { is_deleted: true, is_default: false, updated_by: actorId(req) });

        await logActivity({
            employeeId: actorId(req),
            action: 'work_schedule.archived',
            category: 'attendance',
            description: `Work schedule "${existing.name}" archived`,
            metadata: { schedule_uuid: existing.uuid },
            req,
        });

        return res.status(200).json({ success: true, message: 'Work schedule archived. Employees on it fall back to the default schedule.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/* ------------------------------------------------------------------ *
 * Employee assignment
 * ------------------------------------------------------------------ */
const assign = async (req, res) => {
    try {
        const employeeId = Number(req.body.employee_id);
        if (!Number.isInteger(employeeId) || employeeId <= 0) {
            return res.status(400).json({ success: false, message: 'A valid employee_id is required.' });
        }

        const employee = await Employee.query().findById(employeeId).where('is_deleted', false);
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });

        const schedule = await WorkSchedule.query()
            .where('is_deleted', false)
            .findOne(req.body.schedule_uuid ? { uuid: req.body.schedule_uuid } : { id: Number(req.body.schedule_id) });
        if (!schedule) return res.status(404).json({ success: false, message: 'Work schedule not found.' });

        const effDate = String(req.body.effective_date || '').substring(0, 10)
            || new Date().toISOString().substring(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(effDate)) {
            return res.status(400).json({ success: false, message: 'effective_date must be a valid YYYY-MM-DD date.' });
        }

        const row = await EmployeeScheduleAssignment.transaction((trx) =>
            EmployeeScheduleAssignment.setActive(trx, {
                employeeId, scheduleId: schedule.id, effective_date: effDate, actorId: actorId(req),
            }));

        await logActivity({
            employeeId,
            action: 'work_schedule.assigned',
            category: 'attendance',
            description: `Assigned to work schedule "${schedule.name}" effective ${effDate}`,
            metadata: { schedule_uuid: schedule.uuid, assignment_uuid: row.uuid },
            req,
        });

        return res.status(201).json({ success: true, data: row });
    } catch (error) {
        console.error('WorkSchedule assign error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const employeeAssignments = async (req, res) => {
    try {
        const employeeId = Number(req.params.employeeId);
        const rows = await EmployeeScheduleAssignment.query()
            .where({ employee_id: employeeId, is_deleted: false })
            .withGraphFetched('schedule.[days]')
            .orderBy('effective_date', 'desc');

        const today = new Date().toISOString().substring(0, 10);
        const current = rows.find(
            (r) => String(r.effective_date).substring(0, 10) <= today
                && (!r.end_date || String(r.end_date).substring(0, 10) >= today),
        ) || null;

        return res.status(200).json({ success: true, data: { current, history: rows } });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    list, listAll, getByUuid, create, update, remove, assign, employeeAssignments,
};
