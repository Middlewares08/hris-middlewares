const { ACTIVE_PERMISSION_SLUGS } = require('../constants/permissionMatrix');

/**
 * Soft-deletes every auto-generated permission that no guarded route or UI gate
 * actually references (see src/database/constants/permissionMatrix.js) and drops
 * the now-dead role_permissions links that pointed at them.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.transaction(async (trx) => {
        // 1. Flag the unused permissions as deleted, un-flag the active ones.
        await trx('role_permission.permissions')
            .whereNotIn('slug', ACTIVE_PERMISSION_SLUGS)
            .update({ is_deleted: true, updated_at: knex.fn.now() });

        await trx('role_permission.permissions')
            .whereIn('slug', ACTIVE_PERMISSION_SLUGS)
            .update({ is_deleted: false, updated_at: knex.fn.now() });

        // 2. Remove role -> permission links that now point at a dead permission.
        const deadIds = await trx('role_permission.permissions')
            .where({ is_deleted: true })
            .pluck('id');

        if (deadIds.length) {
            await trx('role_permission.role_permissions')
                .whereIn('permission_id', deadIds)
                .del();
        }
    });
};

/**
 * Best-effort restore: clears the soft-delete flag on every permission. The
 * role_permissions rows removed in `up` are rebuilt by 03_RolePermissionSeeder
 * for the admin role; custom per-role grants to unused permissions are not
 * recoverable (and were the whole point of the prune).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex('role_permission.permissions').update({ is_deleted: false, updated_at: knex.fn.now() });
};
