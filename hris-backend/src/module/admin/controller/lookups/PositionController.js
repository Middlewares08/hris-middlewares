const Position = require('../../../../database/models/lookups/Position');
const Department = require('../../../../database/models/lookups/Department');
const crypto = require('crypto');

// ➕ CREATE
const createPosition = async (req, res) => {
    try {
        const { name, description, department } = req.body;

        // Resolve internal department ID via provided public UUID vector
        const dept = await Department.query().findOne({ uuid: department, is_deleted: false });
        if (!department) {
            return res.status(404).json({ success: false, message: 'Target department mapping missing.' });
        }

        const newPosition = await Position.query().insert({
            uuid: crypto.randomUUID(),
            name,
            description,
            department_id: dept.id,
            created_by: req.user?.id ? parseInt(req.user.id, 10) : null
        });

        return res.status(201).json({ success: true, data: newPosition, message: 'Position generated successfully.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
/**
 * 🔍 READ (Paginated List & Search with Department Relation)
 */
const getPositions = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const { search } = req.query;
        const offset = (page - 1) * limit;

        // 🎯 Initialize the query targeting the correct table string name and schema mapping
        let query = Position.query()
            .withGraphFetched('department')
            .where('lookups.positions.is_deleted', false);
    
     

        // Case-insensitive search using ilike matching your department implementation
        if (search) {
            query = query.where((builder) => {
                builder.where('lookups.positions.name', 'ilike', `%${search}%`)
                .orWhere('lookups.positions.description', 'ilike', `%${search}%`);
            });
        }

        const dept_res = await Department.query()
            .where('lookups.departments.is_deleted', false) // Explicitly prefix this to match your schema
            .select('lookups.departments.name', 'lookups.departments.uuid', 'lookups.departments.id')
            .orderBy('lookups.departments.name', 'asc');

        // Fetch using range math to cleanly construct total metadata parameters
        const result = await query
            .orderBy('lookups.positions.created_at', 'desc')
            .range(offset, offset + limit - 1);

        return res.status(200).json({
            success: true,
            data: result?.results,
            dept: dept_res,
            pagination: {
                totalRecords: result.total,
                currentPage: page,
                recordsPerPage: limit,
                totalPages: Math.ceil(result.total / limit)
            }
        });
    } catch (error) {
        console.error('Fetch positions error:', error);
        return res.status(500).json({ success: false, message: 'Server error retrieving data matrix.' });
    }
};

// 🔍 READ (Single)
const getPositionByUuid = async (req, res) => {
    try {
        const { uuid } = req.params;
        const position = await Position.query()
            .findOne({ uuid, is_deleted: false })
            .withGraphFetched('department');

        if (!position) {
            return res.status(404).json({ success: false, message: 'Position target entry not found.' });
        }

        return res.status(200).json({ success: true, data: position });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 📝 UPDATE
const updatePosition = async (req, res) => {
    try {
        const { uuid } = req.params;
        const { name, description, department } = req.body;

        const updateData = {
            name,
            description,
            updated_by: req.user?.id ? parseInt(req.user.id, 10) : null
        };

        if (name) {
            // For static direct .patch() operations, call your model helper manually to keep the slug accurate
            const dummyInstance = new Position();
            updateData.slug = dummyInstance.generateSlug(name);
        }

        // If the department association is modified, resolve the new structural ID linking field
        if (department) {
            const dept = await Department.query().findOne({ uuid: department, is_deleted: false });
            if (!dept) return res.status(404).json({ success: false, message: 'New target department mapping missing.' });
            updateData.department_id = dept.id;
        }

        const updatedRows = await Position.query()
            .where({ uuid, is_deleted: false })
            .patch(updateData);

        if (updatedRows === 0) {
            return res.status(404).json({ success: false, message: 'Position missing or context unmodified.' });
        }

        return res.status(200).json({ success: true, message: 'Position updated successfully.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ❌ DELETE (Soft Delete Archiving)
const deletePosition = async (req, res) => {
    try {
        const { uuid } = req.params;

        const updatedRows = await Position.query()
            .where({ uuid, is_deleted: false })
            .patch({
                is_deleted: true,
                updated_by: req.user?.id ? parseInt(req.user.id, 10) : null
            });

        if (updatedRows === 0) {
            return res.status(404).json({ success: false, message: 'Position target missing or already archived.' });
        }

        return res.status(200).json({ success: true, message: 'Position archived successfully.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createPosition,
    getPositions,
    getPositionByUuid,
    updatePosition,
    deletePosition
};