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

/**
 * PUT /api/roles/:roleId/permissions
 * Replaces the full set of permissions bound to a role with the supplied list.
 * Body: { permission_ids: number[] }
 */
const updateRolePermissions = async (req, res) => {
    const { roleId } = req.params;
    const { permission_ids: permissionIds } = req.body;

    if (!Array.isArray(permissionIds)) {
        return res.status(400).json({
            success: false,
            message: 'permission_ids must be an array of permission IDs.'
        });
    }

    try {
        const role = await knex('role_permission.roles')
            .where({ id: roleId })
            .first();

        if (!role) {
            return res.status(404).json({
                success: false,
                message: `Role with ID ${roleId} not found.`
            });
        }

        // The Administrator profile always keeps full access. The default employee
        // role (is_default) stays editable so HR can tune the self-service scope.
        if (role.is_deletable === false && !role.is_default) {
            return res.status(400).json({
                success: false,
                message: 'The system administrator role always retains full access and cannot be modified.'
            });
        }

        // Keep only IDs that resolve to a real, non-deleted permission.
        const requestedIds = [...new Set(permissionIds.map(Number).filter(Number.isInteger))];
        const validIds = requestedIds.length
            ? await knex('role_permission.permissions')
                .whereIn('id', requestedIds)
                .andWhere({ is_deleted: false })
                .pluck('id')
            : [];

        const actorId = req.user?.id || null;

        await knex.transaction(async (trx) => {
            await trx('role_permission.role_permissions')
                .where({ role_id: roleId })
                .del();

            if (validIds.length) {
                await trx('role_permission.role_permissions').insert(
                    validIds.map((permission_id) => ({
                        role_id: Number(roleId),
                        permission_id,
                        created_by: actorId,
                        updated_by: actorId
                    }))
                );
            }
        });

        return res.status(200).json({
            success: true,
            role: { id: role.id, name: role.name, slug: role.slug },
            count: validIds.length,
            data: { role_id: Number(roleId), permission_id: validIds }
        });

    } catch (error) {
        console.error('Error updating role permissions:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while updating the permissions matrix.'
        });
    }
};

module.exports = {
    getPermissionsByRoleId,
    updateRolePermissions
};