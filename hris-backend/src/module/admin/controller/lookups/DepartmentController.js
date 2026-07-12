const Department = require('../../../../database/models/lookups/Department');

/**
 * 🔍 READ (Paginated List & Search)
 */
const getAllDepartments = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const { search } = req.query;
        const offset = (page - 1) * limit;

        let query = Department.query().where('is_deleted', false);

        if (search) {
            query = query.where((builder) => {
                builder.where('name', 'ilike', `%${search}%`)
                    .orWhere('code', 'ilike', `%${search}%`);
            });
        }

        const result = await query
            .orderBy('created_at', 'desc')
            .range(offset, offset + limit - 1);

        return res.status(200).json({
            success: true,
            data: result.results, // Will now safely include the secure UUID string
            pagination: {
                totalRecords: result.total,
                currentPage: page,
                recordsPerPage: limit,
                totalPages: Math.ceil(result.total / limit)
            }
        });
    } catch (error) {
        console.error('Fetch departments error:', error);
        return res.status(500).json({ success: false, message: 'Server error retrieving data matrix.' });
    }
};

/**
 * 🎯 READ (Single Target via Secure UUID)
 */
const getDepartmentByUuid = async (req, res) => {
    try {
        const department = await Department.query()
            .findOne({ uuid: req.params.uuid }) // 🎯 Querying via UUID
            .where('is_deleted', false);

        if (!department) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }

        return res.status(200).json({ success: true, data: department });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ➕ CREATE
 */
const createDepartment = async (req, res) => {
    try {
        let { name, code, description } = req.body;

        // 🎯 1. Auto-generate a clean, uppercase code if the front-end didn't send one
        if (!code && name) {
            code = name
                .trim()
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '') // Strip symbols/spaces
                .substring(0, 4);          // Take first 4 characters
        }

        // Validate that we actually have a code to query now
        if (!code) {
            return res.status(400).json({ success: false, message: "Department code or name is required." });
        }

        // 🎯 2. Use .skipUndefined() to protect Objection.js against crash variables
        const existing = await Department.query()
            .skipUndefined()
            .where({ code: code.toUpperCase(), is_deleted: false })
            .first();

        if (existing) {
            return res.status(400).json({ success: false, message: `Code '${code.toUpperCase()}' already exists.` });
        }

        const newDept = await Department.query().insert({
            name,
            code: code.toUpperCase(),
            description: description || null,
            created_by: req.user?.id ? parseInt(req.user.id, 10) : null
        });

        return res.status(201).json({ success: true, data: newDept });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
/**
 * 🔄 UPDATE (via UUID)
 */
const updateDepartment = async (req, res) => {
    try {
        const { name, code, description } = req.body;
        const { uuid } = req.params;

        const department = await Department.query().findOne({ uuid }).where('is_deleted', false);
        
        if (!department) {
            return res.status(404).json({ success: false, message: 'Department node missing.' });
        }

        if (code) {
            const conflict = await Department.query()
                .where('code', code.toUpperCase().trim())
                .whereNot('uuid', uuid)
                .where('is_deleted', false)
                .first();
            if (conflict) {
                return res.status(400).json({ success: false, message: 'Code already assigned elsewhere.' });
            }
        }

        const updatedDept = await Department.query().patchAndFetchById(department.id, {
            name,
            code,
            description,
            updated_by: req.user?.id ? parseInt(req.user.id, 10) : null
        });

        return res.status(200).json({ success: true, data: updatedDept });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ❌ DELETE / ARCHIVE (via UUID)
 */
const deleteDepartment = async (req, res) => {
    try {
        const { uuid } = req.params;
        const department = await Department.query().findOne({ uuid }).where('is_deleted', false);

        console.log('--- DEBUG AUTHENTICATION CONTEXT ---');
        console.log('Full Request User Object:', req.user);
        console.log('Extracted User ID:', req.user?.id);
        if (!department) {
            return res.status(404).json({ success: false, message: 'Department target missing.' });
        }

        await Department.query().patchAndFetchById(department.id, {
            is_deleted: true,
            updated_by: req.user?.id ? parseInt(req.user.id, 10) : null,
        });

        return res.status(200).json({ success: true, message: 'Department archived successfully.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAllDepartments,
    getDepartmentByUuid,
    createDepartment,
    updateDepartment,
    deleteDepartment
};