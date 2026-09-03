const { ACTIVE_PERMISSION_MATRIX, ACTIVE_PERMISSION_SLUGS, ACTION_LABELS } = require('../constants/permissionMatrix');

/**
 * Seeds ONLY the permissions the application actually enforces
 * (src/database/constants/permissionMatrix.js) and soft-deletes anything else
 * so the matrix stays lean.
 *
 * Rows are upserted one at a time on purpose: a single stale/duplicate row can
 * no longer halt the whole seed run (see [[hris-backend-permission-seeder-fragile]]).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
    // 1. Map module slug -> id
    const modules = await knex('role_permission.modules').select('id', 'name', 'slug');

    if (!modules || modules.length === 0) {
        console.warn('⚠️ No modules found in role_permission.modules. Run 01_ModuleSeeeder first.');
        return;
    }

    const moduleBySlug = Object.fromEntries(modules.map((mod) => [mod.slug, mod]));

    // 2. Upsert every active permission
    let synced = 0;

    for (const [moduleSlug, actions] of Object.entries(ACTIVE_PERMISSION_MATRIX)) {
        const mod = moduleBySlug[moduleSlug];

        if (!mod) {
            console.warn(`⚠️ Skipping "${moduleSlug}" permissions — no matching module row.`);
            continue;
        }

        for (const action of actions) {
            const row = {
                module_id: mod.id,
                action,
                name: `${ACTION_LABELS[action]} ${mod.name}`,
                slug: `${mod.slug}:${action}`,
                description: `Allows you to ${action} the ${mod.name.toLowerCase()} module dashboard options.`,
                is_deleted: false,
                created_by: null,
                updated_by: null,
            };

            try {
                await knex('role_permission.permissions')
                    .insert(row)
                    .onConflict('slug')
                    .merge(['action', 'name', 'description', 'module_id', 'is_deleted', 'updated_by']);
                synced += 1;
            } catch (error) {
                console.error(`Error upserting permission "${row.slug}":`, error.message);
            }
        }
    }

    // 3. Soft-delete everything that isn't on the active list
    const removed = await knex('role_permission.permissions')
        .whereNotIn('slug', ACTIVE_PERMISSION_SLUGS)
        .update({ is_deleted: true });

    console.log(`🚀 Synced ${synced} active permissions, soft-deleted ${removed} unused ones.`);
};
