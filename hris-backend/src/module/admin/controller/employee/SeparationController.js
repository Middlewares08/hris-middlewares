const knex = require('../../../../database/connection');
const { logActivity } = require('../../../../utils/activityLogger');

/**
 * Employee separations — the offboarding record behind the turnover / separation
 * reports. Recording a separation flips the employee inactive in the same txn;
 * soft-deleting it flips them back when no other active separation remains.
 *
 * Gated by the existing `employee-management:*` permissions (see employeeRoutes).
 */

const SEPARATION_TYPES = ['resignation', 'termination', 'end_of_contract', 'retirement', 'redundancy', 'death', 'other'];
const VOLUNTARY_TYPES = new Set(['resignation', 'retirement']);

const actorId = (req) => (req.user?.id ? parseInt(req.user.id, 10) : null);
const isYmd = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

const listSeparations = async (req, res) => {
    try {
        const { dateFrom, dateTo, employee_id } = req.query;

        const rows = await knex('employee.separations as s')
            .join('employee.employees as e', 'e.id', 's.employee_id')
            .leftJoin('employee.positions as ep', 'ep.employee_id', 'e.id')
            .leftJoin('lookups.positions as p', 'p.id', 'ep.position_id')
            .leftJoin('lookups.departments as d', 'd.id', 'p.department_id')
            .where('s.is_deleted', false)
            .modify((qb) => {
                if (isYmd(dateFrom)) qb.andWhere('s.separation_date', '>=', dateFrom);
                if (isYmd(dateTo)) qb.andWhere('s.separation_date', '<=', dateTo);
                if (employee_id) qb.andWhere('s.employee_id', employee_id);
            })
            .orderBy('s.separation_date', 'desc')
            .select(
                's.uuid',
                's.employee_id',
                's.separation_date',
                's.last_working_day',
                's.notice_date',
                's.separation_type',
                's.is_voluntary',
                's.reason',
                's.remarks',
                's.eligible_for_rehire',
                's.created_at',
                'e.first_name',
                'e.last_name',
                { employee_no: 'e.employee_id' },
                'e.date_hired',
                'e.is_active',
                { department: 'd.name' },
            );

        return res.status(200).json({
            success: true,
            data: rows.map((r) => ({
                uuid: r.uuid,
                employeeId: r.employee_id,
                employee: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
                employeeNo: r.employee_no || null,
                department: r.department || 'Unassigned',
                dateHired: r.date_hired ? String(r.date_hired).slice(0, 10) : null,
                employeeActive: !!r.is_active,
                separationDate: String(r.separation_date).slice(0, 10),
                lastWorkingDay: r.last_working_day ? String(r.last_working_day).slice(0, 10) : null,
                noticeDate: r.notice_date ? String(r.notice_date).slice(0, 10) : null,
                separationType: r.separation_type,
                isVoluntary: !!r.is_voluntary,
                reason: r.reason || null,
                remarks: r.remarks || null,
                eligibleForRehire: !!r.eligible_for_rehire,
                createdAt: r.created_at,
            })),
        });
    } catch (error) {
        console.error('listSeparations error:', error);
        return res.status(500).json({ success: false, message: 'Server error loading separations.' });
    }
};

const createSeparation = async (req, res) => {
    const {
        employee_id,
        separation_date,
        last_working_day,
        notice_date,
        separation_type,
        is_voluntary,
        reason,
        remarks,
        eligible_for_rehire,
    } = req.body;

    if (!employee_id) return res.status(400).json({ success: false, message: 'employee_id is required.' });
    if (!isYmd(separation_date)) return res.status(400).json({ success: false, message: 'separation_date must be a valid YYYY-MM-DD date.' });
    if (!SEPARATION_TYPES.includes(separation_type)) {
        return res.status(400).json({ success: false, message: `separation_type must be one of: ${SEPARATION_TYPES.join(', ')}.` });
    }

    try {
        const employee = await knex('employee.employees')
            .where({ id: employee_id, is_deleted: false })
            .first('id', 'first_name', 'last_name');
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });

        const existing = await knex('employee.separations')
            .where({ employee_id, is_deleted: false })
            .first('id');
        if (existing) {
            return res.status(409).json({ success: false, message: 'This employee already has an active separation record.' });
        }

        const voluntary = typeof is_voluntary === 'boolean' ? is_voluntary : VOLUNTARY_TYPES.has(separation_type);
        const actor = actorId(req);

        const [created] = await knex.transaction(async (trx) => {
            const inserted = await trx('employee.separations')
                .insert({
                    employee_id,
                    separation_date,
                    last_working_day: isYmd(last_working_day) ? last_working_day : null,
                    notice_date: isYmd(notice_date) ? notice_date : null,
                    separation_type,
                    is_voluntary: voluntary,
                    reason: reason ? String(reason).slice(0, 500) : null,
                    remarks: remarks ? String(remarks).slice(0, 500) : null,
                    eligible_for_rehire: typeof eligible_for_rehire === 'boolean' ? eligible_for_rehire : true,
                    created_by: actor,
                })
                .returning('*');

            await trx('employee.employees')
                .where({ id: employee_id })
                .update({ is_active: false, updated_by: actor, updated_at: knex.fn.now() });

            return inserted;
        });

        logActivity({
            employeeId: employee_id,
            action: 'employee.separated',
            category: 'system',
            description: `${employee.first_name} ${employee.last_name} was separated (${separation_type}).`,
            metadata: { separation_date, separation_type, voluntary },
            req,
        });

        return res.status(201).json({ success: true, message: 'Separation recorded. Employee set to inactive.', data: created });
    } catch (error) {
        console.error('createSeparation error:', error);
        return res.status(500).json({ success: false, message: 'Server error recording the separation.' });
    }
};

const updateSeparation = async (req, res) => {
    const { uuid } = req.params;
    const patch = {};
    const b = req.body;

    if (b.separation_date !== undefined) {
        if (!isYmd(b.separation_date)) return res.status(400).json({ success: false, message: 'separation_date must be a valid YYYY-MM-DD date.' });
        patch.separation_date = b.separation_date;
    }
    if (b.separation_type !== undefined) {
        if (!SEPARATION_TYPES.includes(b.separation_type)) {
            return res.status(400).json({ success: false, message: `separation_type must be one of: ${SEPARATION_TYPES.join(', ')}.` });
        }
        patch.separation_type = b.separation_type;
    }
    if (b.last_working_day !== undefined) patch.last_working_day = isYmd(b.last_working_day) ? b.last_working_day : null;
    if (b.notice_date !== undefined) patch.notice_date = isYmd(b.notice_date) ? b.notice_date : null;
    if (b.is_voluntary !== undefined) patch.is_voluntary = !!b.is_voluntary;
    if (b.reason !== undefined) patch.reason = b.reason ? String(b.reason).slice(0, 500) : null;
    if (b.remarks !== undefined) patch.remarks = b.remarks ? String(b.remarks).slice(0, 500) : null;
    if (b.eligible_for_rehire !== undefined) patch.eligible_for_rehire = !!b.eligible_for_rehire;

    if (Object.keys(patch).length === 0) {
        return res.status(400).json({ success: false, message: 'No valid fields to update.' });
    }
    patch.updated_by = actorId(req);
    patch.updated_at = knex.fn.now();

    try {
        const [updated] = await knex('employee.separations')
            .where({ uuid, is_deleted: false })
            .update(patch)
            .returning('*');

        if (!updated) return res.status(404).json({ success: false, message: 'Separation record not found.' });
        return res.status(200).json({ success: true, message: 'Separation updated.', data: updated });
    } catch (error) {
        console.error('updateSeparation error:', error);
        return res.status(500).json({ success: false, message: 'Server error updating the separation.' });
    }
};

const deleteSeparation = async (req, res) => {
    const { uuid } = req.params;
    const actor = actorId(req);

    try {
        const row = await knex('employee.separations').where({ uuid, is_deleted: false }).first('id', 'employee_id');
        if (!row) return res.status(404).json({ success: false, message: 'Separation record not found.' });

        await knex.transaction(async (trx) => {
            await trx('employee.separations')
                .where({ id: row.id })
                .update({ is_deleted: true, updated_by: actor, updated_at: knex.fn.now() });

            // No other active separation for this employee -> reinstate them.
            const other = await trx('employee.separations')
                .where({ employee_id: row.employee_id, is_deleted: false })
                .first('id');
            if (!other) {
                await trx('employee.employees')
                    .where({ id: row.employee_id })
                    .update({ is_active: true, updated_by: actor, updated_at: knex.fn.now() });
            }
        });

        return res.status(200).json({ success: true, message: 'Separation removed. Employee reinstated if no other separation remained.' });
    } catch (error) {
        console.error('deleteSeparation error:', error);
        return res.status(500).json({ success: false, message: 'Server error removing the separation.' });
    }
};

module.exports = { listSeparations, createSeparation, updateSeparation, deleteSeparation };
