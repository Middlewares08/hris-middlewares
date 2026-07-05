const knex = require('../../../../database/connection'); // Path to your initialized Knex instance

/**
 * GET /api/roles/:roleId/permissions
 * Fetches all permissions bound to a specific role ID
 */
const getPermissionsByRoleId = async (req, res) => {
    const { roleId } = req.params;

    try {
        // 1. Verify the role exists first
        const roleExists = await knex('role_permission.roles')
            .where({ id: roleId })
            .first();

        if (!roleExists) {
            return res.status(404).json({ 
                success: false, 
                message: `Role with ID ${roleId} not found.` 
            });
        }

        // 2. Fetch joined permissions across the schema layout
        const permissions = await knex('role_permission.permissions as p')
            .select(
                'p.id',
                'p.uuid',
                'p.name',
                'p.slug',
                'p.description',
                'm.name as module_name',
                'm.slug as module_slug'
            )
            // Join the junction table linking roles to permissions
            .join('role_permission.role_permissions as rp', 'rp.permission_id', 'p.id')
            // Join modules table to know which system group this permission belongs to
            .leftJoin('role_permission.modules as m', 'p.module_id', 'm.id')
            .where('rp.role_id', roleId);

        // 3. Return the payload safely
        return res.status(200).json({
            success: true,
            role: {
                id: roleExists.id,
                name: roleExists.name,
                slug: roleExists.slug
            },
            count: permissions.length,
            data: permissions
        });

    } catch (error) {
        console.error('Error fetching role permissions:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error while compiling permissions matrix.' 
        });
    }
};

module.exports = {
    getPermissionsByRoleId
};