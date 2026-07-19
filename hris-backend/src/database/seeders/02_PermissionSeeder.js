/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
    // 1. Fetch modules
    const modules = await knex('role_permission.modules').select('id', 'name', 'slug');

    if (!modules || modules.length === 0) {
        console.warn('⚠️ No modules found in role_permission.modules.');
        return;
    }

    const actionsTemplate = [
        { action: 'view',   prefix: 'View',   slugSuffix: 'view' },
        { action: 'create', prefix: 'Create', slugSuffix: 'create' },
        { action: 'edit',   prefix: 'Edit',   slugSuffix: 'edit' },
        { action: 'delete', prefix: 'Delete', slugSuffix: 'delete' }
    ];

    const permissionsToInsert = [];

    modules.forEach((mod) => {
        actionsTemplate.forEach((tmpl) => {
            permissionsToInsert.push({
                module_id: mod.id,
                action: tmpl.action,
                name: `${tmpl.prefix} ${mod.name}`, 
                slug: `${mod.slug}:${tmpl.slugSuffix}`,
                description: `Allows you to ${tmpl.action} the ${mod.name.toLowerCase()} module dashboard options.`,
                is_deleted: false,
                created_by: 1,
                updated_by: null
            });
        });
    });

    // 2. 💡 Fixed Batch Upsert
    try {
        await knex('role_permission.permissions')
            .insert(permissionsToInsert)
            .onConflict('slug') 
            // 🔑 CRITICAL FIX: Explicitly name the columns you want to overwrite on conflict.
            // This tells Knex exactly how to align the compiled SQL parameters.
            .merge(['action', 'name', 'description', 'module_id', 'is_deleted', 'updated_by']);           

        console.log(`🚀 Successfully bulk synchronized ${permissionsToInsert.length} permissions smoothly!`);
    } catch (error) {
        console.error('Error executing permission upsert:', error);
    }
};