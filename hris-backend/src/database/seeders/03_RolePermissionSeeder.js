const { SELF_SERVICE_PERMISSION_SLUGS } = require('../constants/permissionMatrix');

/**
 * Wires role -> permission grants:
 *   - the immutable Administrator role gets every active permission
 *   - the default employee role (`is_default = true`) gets the SELF_SERVICE set
 *   - links pointing at soft-deleted permissions are pruned (any role)
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
    try {
        // The Administrator role: non-deletable and NOT the default employee role.
        const adminRole = await knex('role_permission.roles')
            .where({ is_deletable: false })
            .andWhere((qb) => qb.where({ is_default: false }).orWhereNull('is_default'))
            .first();

        const defaultRole = await knex('role_permission.roles').where({ is_default: true }).first();

        if (!adminRole && !defaultRole) {
            console.warn('⚠️ No Administrator or default employee role found. Skipping junction assignment.');
            return;
        }

        const activePermissions = await knex('role_permission.permissions')
            .select('id', 'slug')
            .where({ is_deleted: false });

        if (activePermissions.length === 0) {
            console.warn('⚠️ No permissions found to assign. Run the permissions seeder first!');
            return;
        }

        const buildLinks = (roleId, permissions) =>
            permissions.map((perm) => ({
                role_id: roleId,
                permission_id: perm.id,
                created_by: null,
                updated_by: null,
            }));

        const grant = async (roleId, permissions, label) => {
            if (!roleId || permissions.length === 0) return;
            await knex('role_permission.role_permissions')
                .insert(buildLinks(roleId, permissions))
                .onConflict(['role_id', 'permission_id'])
                .ignore();
            console.log(`💪 Granted ${permissions.length} permissions to ${label} (Role ID: ${roleId}).`);
        };

        // Administrator -> everything
        await grant(adminRole?.id, activePermissions, 'Administrator');

        // Default employee role -> self-service scope only
        const selfServiceSet = new Set(SELF_SERVICE_PERMISSION_SLUGS);
        const selfServicePermissions = activePermissions.filter((p) => selfServiceSet.has(p.slug));
        await grant(defaultRole?.id, selfServicePermissions, 'default employee role');

        // Prune links (for ANY role) that point at a soft-deleted permission.
        const deadPermissionIds = await knex('role_permission.permissions')
            .where({ is_deleted: true })
            .pluck('id');

        let pruned = 0;
        if (deadPermissionIds.length) {
            pruned = await knex('role_permission.role_permissions')
                .whereIn('permission_id', deadPermissionIds)
                .del();
        }
        console.log(`🧹 Pruned ${pruned} stale role -> permission links.`);
    } catch (error) {
        console.error('Error seeding role_permissions junction matrix:', error);
    }
};
