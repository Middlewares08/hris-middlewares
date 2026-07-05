const Role = require('../../../../database/models/roles-and-permission/Role');

const getRoles = async (req, res) => {
    try {
        // 💡 Simply call your model's static method
        const rolesSummary = await Role.getSummary();

        return res.status(200).json({ 
            success: true, 
            data: rolesSummary 
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};

// 💡 CREATE ROLE (Moved from Model)
const createRole = async (req, res) => {
    try {
        const { name, slug, description } = req.body;

        const newRole = await Role.query().insert({
            name,
            slug: slug || name.toLowerCase().replace(/ /g, '-'),
            description
        });

        return res.status(201).json({
            success: true,
            data: newRole
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// 💡 UPDATE ROLE (Moved from Model)
const updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, slug, description } = req.body;

        const updatedRole = await Role.query().patchAndFetchById(id, {
            name,
            slug: slug || name.toLowerCase().replace(/ /g, '-'),
            description
        });

        return res.status(200).json({
            success: true,
            data: updatedRole
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// 💡 SECURE DELETE WITH TRANSACTION (Moved from Model)
const deleteRole = async (req, res) => {
    try {
        const { id } = req.params;
        const db = Role.knex(); // Grab the underlying knex client from the Objection model

        const deletedResult = await Role.transaction(async (trx) => {
            // 1. Check if employees are assigned to this specific role profile
            const linkedEmployee = await db('role_permission.employee_roles')
                .transacting(trx)
                .where({ role_id: id })
                .first();

            if (linkedEmployee) {
                throw new Error('Cannot delete this role because it is currently assigned to active users.');
            }

            // 2. Remove downstream permission maps inside the pivot layout
            await db('role_permission.role_permissions')
                .transacting(trx)
                .where({ role_id: id })
                .del();

            // 3. Core record deletion execution
            const deletedCount = await Role.query(trx).deleteById(id);
            return deletedCount > 0;
        });

        return res.status(200).json({
            success: true,
            data: deletedResult
        });
    } catch (error) {
        const isValidationError = error.message.includes('assigned to active users');
        
        return res.status(isValidationError ? 400 : 500).json({
            success: false,
            error: error.message
        });
    }
};

module.exports = { 
    getRoles, 
    createRole, 
    updateRole, 
    deleteRole 
};