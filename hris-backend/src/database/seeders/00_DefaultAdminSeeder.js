const { ACTIVE_PERMISSION_SLUGS } = require('../constants/permissionMatrix');

/**
 * First-run bootstrap — RBAC scaffolding only.
 *
 * Creates the two immutable roles the rest of the system assumes already
 * exist. Deliberately does NOT create an admin account (that used to happen
 * here) — the first admin is now provisioned by the public Install Wizard
 * (src/module/public/install.controller.js), which a fresh deployment's first
 * visitor is routed through (product key + their own email; they get a
 * first-login link by email rather than a shared default password). See
 * [[hris-setup-wizard]] memory. Keeping this split means a deployment stays
 * genuinely account-less — no login is possible — until someone completes
 * that wizard, which is the whole point of gating it on a product key.
 *
 *   1. `Administrator` role  — `is_deletable = false`, `is_default = false`.
 *                              Gets EVERY active permission. Cannot be deleted or
 *                              have its grants edited from the admin UI
 *                              (see RolePermissionController).
 *   2. `User` role           — `is_deletable = false`, `is_default = true`.
 *                              The role every new employee is auto-assigned
 *                              (see Employee.$afterInsert / EmployeeController).
 *                              Its self-service grants are filled in by
 *                              03_RolePermissionSeeder.
 *
 * Everything here is idempotent — safe to run on every `knex seed:run`.
 *
 * Runs FIRST (00_) so 01_ModuleSeeeder / 03_RolePermissionSeeder can resolve the
 * immutable roles. The bulk permission grant below is also performed by
 * 03_RolePermissionSeeder; it is repeated here so this seeder alone is enough to
 * make the Administrator role fully usable once modules + permissions exist.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
    const IMMUTABLE_ROLES = [
        {
            name: 'Administrator',
            slug: 'administrator',
            description: 'Full, non-editable system access. Holds every permission.',
            is_deletable: false,
            is_default: false,
        },
        {
            name: 'User',
            slug: 'user',
            description: 'Default role automatically assigned to every employee (self-service scope).',
            is_deletable: false,
            is_default: true,
        },
    ];

    // ------------------------------------------------------------------ 1. Roles
    for (const role of IMMUTABLE_ROLES) {
        const existing = await knex('role_permission.roles').where({ slug: role.slug }).first();

        if (!existing) {
            await knex('role_permission.roles').insert({
                ...role,
                is_deleted: false,
                created_by: null,
                updated_by: null,
            });
            console.log(`[SEED] Created immutable role: ${role.name}`);
        } else {
            // Keep the protection flags in sync without touching anything else.
            await knex('role_permission.roles')
                .where({ id: existing.id })
                .update({
                    is_deletable: role.is_deletable,
                    is_default: role.is_default,
                    is_deleted: false,
                });
            console.log(`[SEED] Verified immutable role: ${role.name}`);
        }
    }

    const adminRole = await knex('role_permission.roles').where({ slug: 'administrator' }).first();

    // ---------------------------------------------- 2. Administrator -> every permission
    const permissions = await knex('role_permission.permissions')
        .select('id')
        .where({ is_deleted: false })
        .whereIn('slug', ACTIVE_PERMISSION_SLUGS);

    if (permissions.length === 0) {
        console.warn(
            '⚠️  No permissions found yet — 02_PermissionSeeder / 03_RolePermissionSeeder will grant them to Administrator.',
        );
    } else {
        await knex('role_permission.role_permissions')
            .insert(
                permissions.map((perm) => ({
                    role_id: adminRole.id,
                    permission_id: perm.id,
                    is_deleted: false,
                    created_by: null,
                    updated_by: null,
                })),
            )
            .onConflict(['role_id', 'permission_id'])
            .ignore();
        console.log(`💪 Granted ${permissions.length} permissions to Administrator (Role ID: ${adminRole.id}).`);
    }
};
