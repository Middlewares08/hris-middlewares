const knex = require('../../../../database/connection'); 

/**
 * GET /api/modules/tree
 * Fetches modules and arrays of nested permissions in a custom object envelope
 */
const getModulesWithPermissionsTree = async (req, res) => {
    try {
        // 1. Pull all active system modules
        const modules = await knex('role_permission.modules')
            .select('id', 'uuid', 'name', 'slug', 'description', 'access_type', 'created_at', 'updated_at')
            .orderBy('name', 'asc');

        // 2. Fetch all permissions that haven't been soft-deleted
        const permissions = await knex('role_permission.permissions')
            .select('id', 'uuid', 'name', 'slug', 'description', 'module_id', 'action', 'created_at', 'updated_at')
            .where({ is_deleted: false })
            .orderBy('name', 'asc');

        // 3. Construct your custom tree format
        const formattedTree = modules.map((mod) => {
            return {
                // Spreads all the raw database attributes of the module
                ...mod, 
                
                // Filters down to only matching sub-permissions
                permission: permissions.filter(perm => perm.module_id === mod.id)
            };
        });

        // 4. Return encapsulated inside the requested "module" wrapper envelope
        return res.status(200).json({
            module: formattedTree
        });

    } catch (error) {
        console.error('Error compiling module data tree:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error while building module-permission map tree.' 
        });
    }
};

module.exports = {
    getModulesWithPermissionsTree
};