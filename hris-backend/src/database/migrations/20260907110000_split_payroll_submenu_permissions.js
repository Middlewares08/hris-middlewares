const { ACCESS_TYPES, ACTION_LABELS, PAYROLL_SUBMENU_MODULES, ADMIN_PERMISSION_MATRIX } = require('../constants/permissionMatrix');

// Which of the 5 new Payroll submenu modules absorb which slice of the two old
// catch-all slugs, and for which actions (some new modules don't carry every
// action, e.g. payslip-requests/employer-profile have no `create`).
const CARRY_FORWARD = {
    'run-payroll': ['payroll-runs', 'payslip-requests', 'pay-periods'],
    'payroll-and-compensation': ['pay-components', 'employer-profile'],
};

/**
 * Splits the old catch-all `run-payroll` (and, for two of the new modules,
 * `payroll-and-compensation`) permission slugs into one module per Payroll
 * sidebar submenu page (see PAYROLL_SUBMENU_MODULES in permissionMatrix.js),
 * so each page is independently grantable in the Roles & Permission tree.
 *
 * Self-contained like 20260903093000_add_app_access_permissions.js: creates
 * the module + permission rows itself rather than depending on a manual
 * `npx knex seed:run`, then carries forward every role's existing grant on the
 * old slug onto the corresponding new slug(s) so no custom role silently loses
 * access. `payroll-and-compensation` itself is untouched (still covers
 * Employee Compensation + Bank Details); `run-payroll` is fully replaced and
 * soft-deleted.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.transaction(async (trx) => {
        // 1. Create the 5 new modules (idempotent by slug).
        const moduleBySlug = {};
        for (const mod of PAYROLL_SUBMENU_MODULES) {
            let row = await trx('role_permission.modules').where({ slug: mod.slug }).first();
            if (!row) {
                [row] = await trx('role_permission.modules')
                    .insert({
                        name: mod.name,
                        slug: mod.slug,
                        description: mod.description,
                        access_type: ACCESS_TYPES.ADMIN,
                        created_by: null,
                        updated_by: null,
                    })
                    .returning('*');
            }
            moduleBySlug[mod.slug] = row;
        }

        // 2. Create their permissions per the matrix (upsert by slug).
        const newPermissionIds = [];
        for (const mod of PAYROLL_SUBMENU_MODULES) {
            const actions = ADMIN_PERMISSION_MATRIX[mod.slug] || [];
            for (const action of actions) {
                const [perm] = await trx('role_permission.permissions')
                    .insert({
                        module_id: moduleBySlug[mod.slug].id,
                        action,
                        name: `${ACTION_LABELS[action]} ${mod.name}`,
                        slug: `${mod.slug}:${action}`,
                        description: `Allows you to ${action} the ${mod.name.toLowerCase()} module dashboard options.`,
                        is_deleted: false,
                        created_by: null,
                        updated_by: null,
                    })
                    .onConflict('slug')
                    .merge(['action', 'name', 'description', 'module_id', 'is_deleted', 'updated_by'])
                    .returning('*');
                newPermissionIds.push(perm);
            }
        }
        const newPermByModuleAction = Object.fromEntries(
            newPermissionIds.map((p) => [`${p.module_id}:${p.action}`, p.id]),
        );
        const moduleIdBySlug = Object.fromEntries(Object.entries(moduleBySlug).map(([slug, row]) => [slug, row.id]));

        // 3. Carry forward existing role grants from the old slugs onto every
        //    new module they were split into (same action only where it exists
        //    on the new module).
        for (const [oldSlug, newSlugs] of Object.entries(CARRY_FORWARD)) {
            const oldPermissions = await trx('role_permission.permissions')
                .where('slug', 'like', `${oldSlug}:%`)
                .select('id', 'action');

            for (const oldPerm of oldPermissions) {
                const grantedRoleIds = await trx('role_permission.role_permissions')
                    .where({ permission_id: oldPerm.id })
                    .pluck('role_id');

                if (!grantedRoleIds.length) continue;

                const links = [];
                for (const newSlug of newSlugs) {
                    const newPermId = newPermByModuleAction[`${moduleIdBySlug[newSlug]}:${oldPerm.action}`];
                    if (!newPermId) continue; // e.g. payslip-requests/employer-profile has no `create`
                    for (const roleId of grantedRoleIds) {
                        links.push({ role_id: roleId, permission_id: newPermId, created_by: null, updated_by: null });
                    }
                }

                if (links.length) {
                    await trx('role_permission.role_permissions').insert(links).onConflict(['role_id', 'permission_id']).ignore();
                }
            }
        }

        // 4. `run-payroll` is now fully replaced — soft-delete it.
        await trx('role_permission.permissions')
            .where('slug', 'like', 'run-payroll:%')
            .update({ is_deleted: true, updated_at: knex.fn.now() });
    });
};

/**
 * Best-effort: un-soft-deletes `run-payroll:*`, then drops the 5 new modules
 * (cascades their permissions/role_permissions). Custom per-role grants made
 * directly against the new slugs after this migration ran are not recoverable.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex('role_permission.permissions')
        .where('slug', 'like', 'run-payroll:%')
        .update({ is_deleted: false, updated_at: knex.fn.now() });

    for (const mod of PAYROLL_SUBMENU_MODULES) {
        const row = await knex('role_permission.modules').where({ slug: mod.slug }).first();
        if (!row) continue;
        const permIds = await knex('role_permission.permissions').where({ module_id: row.id }).pluck('id');
        if (permIds.length) {
            await knex('role_permission.role_permissions').whereIn('permission_id', permIds).del();
            await knex('role_permission.permissions').whereIn('id', permIds).del();
        }
        await knex('role_permission.modules').where({ id: row.id }).del();
    }
};
