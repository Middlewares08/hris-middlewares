const { EXTRA_ADMIN_MODULES, ACCESS_TYPES } = require('../constants/permissionMatrix');

/**
 * Adds the two "may this account sign in here at all" gates:
 *   admin-console:access      -> the admin dashboard (hris-frontend)
 *   employee-portal:access    -> the employee PWA (hris-user)
 *
 * The `employee-portal` module/permission is created by
 * 20260903090000_add_self_service_permission_scope; here we add `admin-console`
 * and wire both gate permissions onto the right roles.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    // 1. admin-console module (ADMIN scope)
    const adminConsole = EXTRA_ADMIN_MODULES.find((m) => m.slug === 'admin-console');
    let mod = await knex('role_permission.modules').where({ slug: 'admin-console' }).first();
    if (!mod) {
        [mod] = await knex('role_permission.modules')
            .insert({
                name: adminConsole.name,
                slug: adminConsole.slug,
                description: adminConsole.description,
                access_type: ACCESS_TYPES.ADMIN,
                created_by: null,
                updated_by: null,
            })
            .returning('*');
    }

    // 2. admin-console:access permission
    await knex('role_permission.permissions')
        .insert({
            module_id: mod.id,
            action: 'access',
            name: 'Access Admin Console',
            slug: 'admin-console:access',
            description: 'Allows the account to sign in to the admin dashboard.',
            is_deleted: false,
            created_by: null,
            updated_by: null,
        })
        .onConflict('slug')
        .merge(['action', 'name', 'description', 'module_id', 'is_deleted', 'updated_by']);

    // 3. Wire the gates onto roles.
    const bySlug = Object.fromEntries(
        (await knex('role_permission.permissions')
            .whereIn('slug', ['admin-console:access', 'employee-portal:access'])
            .select('id', 'slug')).map((p) => [p.slug, p.id]),
    );

    const adminRole = await knex('role_permission.roles')
        .where({ is_deletable: false })
        .andWhere((qb) => qb.where({ is_default: false }).orWhereNull('is_default'))
        .first();
    const defaultRole = await knex('role_permission.roles').where({ is_default: true }).first();

    const links = [];
    if (adminRole) {
        if (bySlug['admin-console:access']) links.push({ role_id: adminRole.id, permission_id: bySlug['admin-console:access'] });
        if (bySlug['employee-portal:access']) links.push({ role_id: adminRole.id, permission_id: bySlug['employee-portal:access'] });
    }
    if (defaultRole && bySlug['employee-portal:access']) {
        links.push({ role_id: defaultRole.id, permission_id: bySlug['employee-portal:access'] });
    }

    if (links.length) {
        await knex('role_permission.role_permissions')
            .insert(links.map((l) => ({ ...l, created_by: null, updated_by: null })))
            .onConflict(['role_id', 'permission_id'])
            .ignore();
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    const perm = await knex('role_permission.permissions').where({ slug: 'admin-console:access' }).first();
    if (perm) {
        await knex('role_permission.role_permissions').where({ permission_id: perm.id }).del();
        await knex('role_permission.permissions').where({ id: perm.id }).del();
    }
    await knex('role_permission.modules').where({ slug: 'admin-console' }).del();
    // employee-portal:access is owned by the self-service migration's down().
};
