const Holiday = require('../../../../database/models/attendance/Holiday');
const { logActivity } = require('../../../../utils/activityLogger');

const actorId = (req) => (req.user?.id ? parseInt(req.user.id, 10) : null);
const isYmd = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

const validate = (body, { partial = false } = {}) => {
    if (!partial || body.date !== undefined) {
        if (!isYmd(body.date)) return 'date must be a valid YYYY-MM-DD date.';
    }
    if (!partial || body.name !== undefined) {
        if (!String(body.name || '').trim()) return 'name is required.';
    }
    if (body.type !== undefined && !Holiday.TYPES.includes(body.type)) {
        return `type must be one of: ${Holiday.TYPES.join(', ')}`;
    }
    return null;
};

const list = async (req, res) => {
    try {
        const { year, from, to, search } = req.query;
        let query = Holiday.query().where('is_deleted', false);

        if (isYmd(from)) query = query.where('date', '>=', from);
        if (isYmd(to)) query = query.where('date', '<=', to);
        if (/^\d{4}$/.test(String(year || ''))) {
            query = query.where('date', '>=', `${year}-01-01`).where('date', '<=', `${year}-12-31`);
        }
        if (search) query = query.where('name', 'ilike', `%${search}%`);

        const rows = await query.orderBy('date', 'asc');
        return res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error('Holiday list error:', error);
        return res.status(500).json({ success: false, message: 'Server error retrieving holidays.' });
    }
};

const create = async (req, res) => {
    try {
        const err = validate(req.body);
        if (err) return res.status(400).json({ success: false, message: err });

        const date = String(req.body.date).substring(0, 10);
        const name = String(req.body.name).trim();

        const clash = await Holiday.query().where({ date, is_deleted: false }).whereRaw('LOWER(name) = LOWER(?)', [name]).first();
        if (clash) return res.status(400).json({ success: false, message: `"${name}" is already on the calendar for ${date}.` });

        const row = await Holiday.query().context({ user: { id: actorId(req) } }).insertAndFetch({
            date,
            name,
            type: req.body.type || 'regular',
            is_active: req.body.is_active === undefined ? true : !!req.body.is_active,
        });

        await logActivity({
            employeeId: actorId(req),
            action: 'holiday.created',
            category: 'attendance',
            description: `Holiday "${name}" added for ${date}`,
            metadata: { holiday_uuid: row.uuid },
            req,
        });

        return res.status(201).json({ success: true, data: row });
    } catch (error) {
        console.error('Holiday create error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const update = async (req, res) => {
    try {
        const err = validate(req.body, { partial: true });
        if (err) return res.status(400).json({ success: false, message: err });

        const existing = await Holiday.query().findOne({ uuid: req.params.uuid }).where('is_deleted', false);
        if (!existing) return res.status(404).json({ success: false, message: 'Holiday not found.' });

        const patch = { updated_by: actorId(req) };
        if (req.body.date !== undefined) patch.date = String(req.body.date).substring(0, 10);
        if (req.body.name !== undefined) patch.name = String(req.body.name).trim();
        if (req.body.type !== undefined) patch.type = req.body.type;
        if (req.body.is_active !== undefined) patch.is_active = !!req.body.is_active;

        const row = await Holiday.query().context({ user: { id: actorId(req) } }).patchAndFetchById(existing.id, patch);

        await logActivity({
            employeeId: actorId(req),
            action: 'holiday.updated',
            category: 'attendance',
            description: `Holiday "${row.name}" (${row.date}) updated`,
            metadata: { holiday_uuid: row.uuid },
            req,
        });

        return res.status(200).json({ success: true, data: row });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const remove = async (req, res) => {
    try {
        const existing = await Holiday.query().findOne({ uuid: req.params.uuid }).where('is_deleted', false);
        if (!existing) return res.status(404).json({ success: false, message: 'Holiday not found.' });

        await Holiday.query()
            .context({ user: { id: actorId(req) } })
            .patchAndFetchById(existing.id, { is_deleted: true, updated_by: actorId(req) });

        await logActivity({
            employeeId: actorId(req),
            action: 'holiday.archived',
            category: 'attendance',
            description: `Holiday "${existing.name}" (${existing.date}) removed`,
            metadata: { holiday_uuid: existing.uuid },
            req,
        });

        return res.status(200).json({ success: true, message: 'Holiday removed.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { list, create, update, remove };
