const {
    SELF_SERVICE_MODULES,
    SELF_SERVICE_PERMISSION_MATRIX,
    SELF_SERVICE_PERMISSION_SLUGS,
    ACTION_LABELS,
    ACCESS_TYPES,
} = require('../constants/permissionMatrix');

/**
 * Introduces the SELF_SERVICE permission scope for the employee PWA:
 *   - `roles.is_default` flags the role every employee gets automatically
 *   - seeds the `my-*` modules (access_type = SELF_SERVICE) + their permissions
 *   - grants the self-service permissions to the default employee role AND the admin role
 *   - backfills `employee_roles` so no existing employee is left without a role
 *
 * Mirrors the seeder logic so existing databases are brought up to date without
 * a full `knex seed:run` (see [[hris-backend-permission-seeder-fragile]]).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    // 1. roles.is_default
    const hasIsDefault = await knex.schema.withSchema('role_permission').hasColumn('roles', 'is_default');
    if (!hasIsDefault) {
        await knex.schema.withSchema('role_permission').alterTable('roles', (table) => {
            table.boolean('is_default').notNullable().defaultTo(false);
        });
    }
    await knex('role_permission.roles').where({ slug: 'user' }).update({ is_default: true });

    // 2. SELF_SERVICE module rows
    for (const mod of SELF_SERVICE_MODULES) {
        const existing = await knex('role_permission.modules').where({ slug: mod.slug }).first();
        if (!existing) {
            await knex('role_permission.modules').insert({
                name: mod.name,
                slug: mod.slug,
                description: mod.description,
                access_type: ACCESS_TYPES.SELF_SERVICE,
                created_by: null,
                updated_by: null,
            });
        } else {
            await knex('role_permission.modules')
                .where({ id: existing.id })
                .update({ access_type: ACCESS_TYPES.SELF_SERVICE });
        }
    }

    // 3. SELF_SERVICE permission rows
    const moduleBySlug = Object.fromEntries(
        (await knex('role_permission.modules').select('id', 'name', 'slug')).map((m) => [m.slug, m]),
    );

    for (const [moduleSlug, actions] of Object.entries(SELF_SERVICE_PERMISSION_MATRIX)) {
        const mod = moduleBySlug[moduleSlug];
        if (!mod) continue;

        for (const action of actions) {
            await knex('role_permission.permissions')
                .insert({
                    module_id: mod.id,
                    action,
                    name: `${ACTION_LABELS[action]} ${mod.name}`,
                    slug: `${mod.slug}:${action}`,
                    description: `Allows the employee to ${action} their own ${mod.name.replace(/^My /, '').toLowerCase()}.`,
                    is_deleted: false,
                    created_by: null,
                    updated_by: null,
                })
                .onConflict('slug')
                .merge(['action', 'name', 'description', 'module_id', 'is_deleted', 'updated_by']);
        }
    }

    // 4. Grant the self-service permissions to the default employee role + the admin role
    const selfServiceIds = await knex('role_permission.permissions')
        .whereIn('slug', SELF_SERVICE_PERMISSION_SLUGS)
        .pluck('id');

    const targetRoles = await knex('role_permission.roles')
        .where({ is_default: true })
        .orWhere({ is_deletable: false })
        .pluck('id');

    if (selfServiceIds.length && targetRoles.length) {
        const links = targetRoles.flatMap((roleId) =>
            selfServiceIds.map((permId) => ({
                role_id: roleId,
                permission_id: permId,
                created_by: null,
                updated_by: null,
            })),
        );
        await knex('role_permission.role_permissions')
            .insert(links)
            .onConflict(['role_id', 'permission_id'])
            .ignore();
    }

    // 5. Backfill employee_roles — any employee with no role at all gets the default role
    const defaultRole = await knex('role_permission.roles').where({ is_default: true }).first();
    if (defaultRole) {
        const orphanEmployees = await knex('employee.employees as e')
            .leftJoin('role_permission.employee_roles as er', 'er.employee_id', 'e.id')
            .whereNull('er.id')
            .pluck('e.id');

        if (orphanEmployees.length) {
            await knex('role_permission.employee_roles')
                .insert(orphanEmployees.map((employee_id) => ({
                    employee_id,
                    role_id: defaultRole.id,
                    created_by: null,
                    updated_by: null,
                })))
                .onConflict(['employee_id', 'role_id'])
                .ignore();
        }
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    const selfServiceModuleSlugs = SELF_SERVICE_MODULES.map((m) => m.slug);

    const moduleIds = await knex('role_permission.modules')
        .whereIn('slug', selfServiceModuleSlugs)
        .pluck('id');

    if (moduleIds.length) {
        const permIds = await knex('role_permission.permissions').whereIn('module_id', moduleIds).pluck('id');
        if (permIds.length) {
            await knex('role_permission.role_permissions').whereIn('permission_id', permIds).del();
            await knex('role_permission.permissions').whereIn('id', permIds).del();
        }
        await knex('role_permission.modules').whereIn('id', moduleIds).del();
    }

    const hasIsDefault = await knex.schema.withSchema('role_permission').hasColumn('roles', 'is_default');
    if (hasIsDefault) {
        await knex.schema.withSchema('role_permission').alterTable('roles', (table) => {
            table.dropColumn('is_default');
        });
    }
};
