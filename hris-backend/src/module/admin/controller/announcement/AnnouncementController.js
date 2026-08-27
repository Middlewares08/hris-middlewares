const Announcement = require('../../../../database/models/announcement/Announcement');
const { logActivity } = require('../../../../utils/activityLogger');

const { PRIORITIES, STATUSES } = Announcement;

const actorId = (req) => (req.user?.id ? parseInt(req.user.id, 10) : null);
const isValidTimestamp = (value) => !Number.isNaN(Date.parse(value));

/**
 * ✅ Shared payload validation for create / update
 */
const validatePayload = (body, { partial = false } = {}) => {
    const { title, body: content, priority, status, published_at, expires_at, link_url } = body;

    if (!partial || title !== undefined) {
        if (!title || !String(title).trim()) return 'title is required.';
        if (String(title).trim().length > 200) return 'title must be 200 characters or fewer.';
    }
    if (!partial || content !== undefined) {
        if (!content || !String(content).trim()) return 'body is required.';
    }
    if (priority !== undefined && !PRIORITIES.includes(priority)) {
        return `priority must be one of: ${PRIORITIES.join(', ')}`;
    }
    if (status !== undefined && !STATUSES.includes(status)) {
        return `status must be one of: ${STATUSES.join(', ')}`;
    }
    if (published_at != null && published_at !== '' && !isValidTimestamp(published_at)) {
        return 'published_at must be a valid date/time.';
    }
    if (expires_at != null && expires_at !== '' && !isValidTimestamp(expires_at)) {
        return 'expires_at must be a valid date/time.';
    }
    if (
        published_at && expires_at &&
        isValidTimestamp(published_at) && isValidTimestamp(expires_at) &&
        Date.parse(expires_at) <= Date.parse(published_at)
    ) {
        return 'expires_at must be later than published_at.';
    }
    if (link_url != null && link_url !== '' && String(link_url).length > 500) {
        return 'link_url must be 500 characters or fewer.';
    }
    return null;
};

/* ============================================================
 * SELF-SERVICE (any authenticated employee)
 * ========================================================== */

/**
 * 📣 READ — the live announcement feed for the authenticated employee.
 * Powers the "Announcements" card on the user dashboard.
 */
const getPublishedAnnouncements = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

        const announcements = await Announcement.visibleToEmployees(Announcement.query())
            .orderBy('is_pinned', 'desc')
            .orderByRaw('COALESCE(published_at, created_at) DESC')
            .limit(limit);

        return res.status(200).json({ success: true, data: announcements });
    } catch (error) {
        console.error('Fetch published announcements error:', error);
        return res.status(500).json({ success: false, message: 'Server error retrieving announcements.' });
    }
};

/**
 * 🎯 READ — a single live announcement via secure UUID (for the detail modal).
 */
const getPublishedAnnouncementByUuid = async (req, res) => {
    try {
        const announcement = await Announcement.visibleToEmployees(Announcement.query())
            .findOne({ 'announcement.announcements.uuid': req.params.uuid });

        if (!announcement) {
            return res.status(404).json({ success: false, message: 'Announcement not found.' });
        }

        return res.status(200).json({ success: true, data: announcement });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/* ============================================================
 * ADMIN (gated by the 'Announcements' module permissions)
 * ========================================================== */

/**
 * 🔍 READ — paginated list (all statuses), with search & filters
 */
const getAllAnnouncements = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const { search, status, priority, is_pinned } = req.query;
        const offset = (page - 1) * limit;

        let query = Announcement.query()
            .where('announcement.announcements.is_deleted', false)
            .withGraphFetched('[creator, editor]');

        if (status) query = query.where('status', status);
        if (priority) query = query.where('priority', priority);
        if (is_pinned !== undefined) query = query.where('is_pinned', is_pinned === 'true');

        if (search) {
            query = query.where((builder) => {
                builder.where('title', 'ilike', `%${search}%`)
                    .orWhere('body', 'ilike', `%${search}%`);
            });
        }

        const result = await query
            .orderBy('created_at', 'desc')
            .range(offset, offset + limit - 1);

        return res.status(200).json({
            success: true,
            data: result.results,
            pagination: {
                totalRecords: result.total,
                currentPage: page,
                recordsPerPage: limit,
                totalPages: Math.ceil(result.total / limit)
            }
        });
    } catch (error) {
        console.error('Fetch announcements error:', error);
        return res.status(500).json({ success: false, message: 'Server error retrieving data matrix.' });
    }
};

/**
 * 🎯 READ — single record via secure UUID (admin, any status)
 */
const getAnnouncementByUuid = async (req, res) => {
    try {
        const announcement = await Announcement.query()
            .findOne({ uuid: req.params.uuid })
            .where('is_deleted', false)
            .withGraphFetched('[creator, editor]');

        if (!announcement) {
            return res.status(404).json({ success: false, message: 'Announcement not found.' });
        }

        return res.status(200).json({ success: true, data: announcement });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ➕ CREATE
 */
const createAnnouncement = async (req, res) => {
    try {
        const callerId = actorId(req);
        const {
            title, body, priority = 'info', status = 'draft',
            is_pinned = false, published_at, expires_at, link_url
        } = req.body;

        const validationError = validatePayload(req.body);
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        const announcement = await Announcement.query().insertAndFetch({
            title: String(title).trim(),
            body: String(body).trim(),
            priority,
            status,
            is_pinned: Boolean(is_pinned),
            published_at: published_at || null,
            expires_at: expires_at || null,
            link_url: link_url ? String(link_url).trim() : null,
            created_by: callerId
        });

        await logActivity({
            employeeId: callerId,
            action: 'announcement.created',
            category: 'system',
            description: `Created announcement "${announcement.title}"`,
            metadata: { announcement_uuid: announcement.uuid, status: announcement.status },
            req
        });

        return res.status(201).json({ success: true, data: announcement });
    } catch (error) {
        console.error('Create announcement error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 🔄 UPDATE (via UUID)
 */
const updateAnnouncement = async (req, res) => {
    try {
        const { uuid } = req.params;
        const callerId = actorId(req);

        const announcement = await Announcement.query().findOne({ uuid }).where('is_deleted', false);
        if (!announcement) {
            return res.status(404).json({ success: false, message: 'Announcement not found.' });
        }

        const validationError = validatePayload(req.body, { partial: true });
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        const { title, body, priority, status, is_pinned, published_at, expires_at, link_url } = req.body;

        const patch = {
            title: title === undefined ? undefined : String(title).trim(),
            body: body === undefined ? undefined : String(body).trim(),
            priority,
            status,
            is_pinned: is_pinned === undefined ? undefined : Boolean(is_pinned),
            published_at: published_at === undefined ? undefined : (published_at || null),
            expires_at: expires_at === undefined ? undefined : (expires_at || null),
            link_url: link_url === undefined ? undefined : (link_url ? String(link_url).trim() : null),
            updated_by: callerId
        };

        // Backfill published_at the first time an entry goes live without an explicit date
        if (status === 'published' && !announcement.published_at && published_at === undefined) {
            patch.published_at = new Date().toISOString();
        }

        const updated = await Announcement.query().patchAndFetchById(announcement.id, patch);

        await logActivity({
            employeeId: callerId,
            action: 'announcement.updated',
            category: 'system',
            description: `Updated announcement "${updated.title}"`,
            metadata: { announcement_uuid: updated.uuid, status: updated.status },
            req
        });

        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        console.error('Update announcement error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 📌 STATUS (via UUID) — publish / archive / revert to draft in one call
 */
const setAnnouncementStatus = async (req, res) => {
    try {
        const { uuid } = req.params;
        const callerId = actorId(req);
        const { status } = req.body;

        if (!STATUSES.includes(status)) {
            return res.status(400).json({ success: false, message: `status must be one of: ${STATUSES.join(', ')}` });
        }

        const announcement = await Announcement.query().findOne({ uuid }).where('is_deleted', false);
        if (!announcement) {
            return res.status(404).json({ success: false, message: 'Announcement not found.' });
        }

        const patch = { status, updated_by: callerId };
        if (status === 'published' && !announcement.published_at) {
            patch.published_at = new Date().toISOString();
        }

        const updated = await Announcement.query().patchAndFetchById(announcement.id, patch);

        await logActivity({
            employeeId: callerId,
            action: `announcement.${status}`,
            category: 'system',
            description: `Announcement "${updated.title}" set to ${status}`,
            metadata: { announcement_uuid: updated.uuid },
            req
        });

        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        console.error('Set announcement status error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ❌ DELETE / ARCHIVE (via UUID) — soft delete
 */
const deleteAnnouncement = async (req, res) => {
    try {
        const { uuid } = req.params;
        const callerId = actorId(req);

        const announcement = await Announcement.query().findOne({ uuid }).where('is_deleted', false);
        if (!announcement) {
            return res.status(404).json({ success: false, message: 'Announcement not found.' });
        }

        await Announcement.query().patchAndFetchById(announcement.id, {
            is_deleted: true,
            updated_by: callerId
        });

        await logActivity({
            employeeId: callerId,
            action: 'announcement.archived',
            category: 'system',
            description: `Announcement "${announcement.title}" archived`,
            metadata: { announcement_uuid: announcement.uuid },
            req
        });

        return res.status(200).json({ success: true, message: 'Announcement archived successfully.' });
    } catch (error) {
        console.error('Delete announcement error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getPublishedAnnouncements,
    getPublishedAnnouncementByUuid,
    getAllAnnouncements,
    getAnnouncementByUuid,
    createAnnouncement,
    updateAnnouncement,
    setAnnouncementStatus,
    deleteAnnouncement
};
