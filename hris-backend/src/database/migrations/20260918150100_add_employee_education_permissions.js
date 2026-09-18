const { ACCESS_TYPES, ACTION_LABELS, ADMIN_PERMISSION_MATRIX, SELF_SERVICE_PERMISSION_MATRIX, SELF_SERVICE_MODULES } = require('../constants/permissionMatrix');

const MY_EDUCATION_META = SELF_SERVICE_MODULES.find((m) => m.slug === 'my-education');

// Self-contained like 20260907110000_split_payroll_submenu_permissions.js: creates
// the module + permission rows itself so an already-running install picks up the
// new Educational Background feature without a manual `npx knex seed:run`.
const NEW_MODULES = [
    {
        slug: 'employee-education',
        name: 'Educational Background',
        description: 'Employee educational background records captured during onboarding.',
        accessType: ACCESS_TYPES.ADMIN,
        matrix: ADMIN_PERMISSION_MATRIX,
    },
    {
        slug: 'my-education',
        name: MY_EDUCATION_META.name,
        description: MY_EDUCATION_META.description,
        accessType: ACCESS_TYPES.SELF_SERVICE,
        matrix: SELF_SERVICE_PERMISSION_MATRIX,
    },
];

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.transaction(async (trx) => {
        // 1. Create the modules (idempotent by slug).
        const moduleBySlug = {};
        for (const mod of NEW_MODULES) {
            let row = await trx('role_permission.modules').where({ slug: mod.slug }).first();
            if (!row) {
                [row] = await trx('role_permission.modules')
                    .insert({
                        name: mod.name,
                        slug: mod.slug,
                        description: mod.description,
                        access_type: mod.accessType,
                        created_by: null,
                        updated_by: null,
                    })
                    .returning('*');
            }
            moduleBySlug[mod.slug] = row;
        }

        // 2. Create their permissions per the matrix (upsert by slug).
        const permIdBySlug = {};
        for (const mod of NEW_MODULES) {
            const actions = mod.matrix[mod.slug] || [];
            for (const action of actions) {
                const [perm] = await trx('role_permission.permissions')
                    .insert({
                        module_id: moduleBySlug[mod.slug].id,
                        action,
                        name: `${ACTION_LABELS[action]} ${mod.name}`,
                        slug: `${mod.slug}:${action}`,
                        description: `Allows you to ${action} the ${mod.name.toLowerCase()} module.`,
                        is_deleted: false,
                        created_by: null,
                        updated_by: null,
                    })
                    .onConflict('slug')
                    .merge(['action', 'name', 'description', 'module_id', 'is_deleted', 'updated_by'])
                    .returning('*');
                permIdBySlug[perm.slug] = perm.id;
            }
        }

        // 3. Grant: Administrator gets everything new; the default employee role
        //    only gets the self-service (`my-education:*`) slice.
        const adminRole = await trx('role_permission.roles')
            .where({ is_deletable: false })
            .andWhere((qb) => qb.where({ is_default: false }).orWhereNull('is_default'))
            .first();
        const defaultRole = await trx('role_permission.roles').where({ is_default: true }).first();

        const links = [];
        if (adminRole) {
            for (const permId of Object.values(permIdBySlug)) {
                links.push({ role_id: adminRole.id, permission_id: permId, created_by: null, updated_by: null });
            }
        }
        if (defaultRole) {
            for (const [slug, permId] of Object.entries(permIdBySlug)) {
                if (slug.startsWith('my-education:')) {
                    links.push({ role_id: defaultRole.id, permission_id: permId, created_by: null, updated_by: null });
                }
            }
        }

        if (links.length) {
            await trx('role_permission.role_permissions').insert(links).onConflict(['role_id', 'permission_id']).ignore();
        }
    });
};

/**
 * Drops the 2 new modules (cascades their permissions/role_permissions). Custom
 * per-role grants made directly against these slugs after this migration ran are
 * not recoverable.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    for (const mod of NEW_MODULES) {
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
