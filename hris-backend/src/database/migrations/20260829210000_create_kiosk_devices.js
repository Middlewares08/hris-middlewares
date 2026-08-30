/**
 * Attendance Kiosk — registered shared devices that run the face-recognition
 * clock-in/out screen. Each device authenticates to the /kiosk/* endpoints with
 * its own bearer token (only the sha256 hash is stored here), so a lost or
 * decommissioned device can be revoked without touching anyone's login.
 *
 * Seeds the `attendance-kiosk` permission module inside the migration to dodge
 * the fragile seeder chain (same pattern as 20260829130000_create_face_enrollments).
 *
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
    await knex.raw('CREATE SCHEMA IF NOT EXISTS attendance');
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await knex.schema.withSchema('attendance').createTable('kiosk_devices', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        table.string('name').notNullable();
        table.string('location').nullable();

        // sha256(raw token) — the raw token is shown to the admin exactly once
        table.string('token_hash').notNullable().unique();
        // first 8 chars of the raw token, for identifying a device in the admin list
        table.string('token_prefix', 12).notNullable();

        table.enum('status', ['active', 'revoked']).notNullable().defaultTo('active');
        table.timestamp('last_seen_at', { useTz: true }).nullable();

        table.boolean('is_deleted').notNullable().defaultTo(false);
        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees').onDelete('SET NULL');
        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees').onDelete('SET NULL');
        table.timestamps(true, true);

        table.index(['status', 'is_deleted']);
    });

    // ---- permission module (mirrors the face-recognition migration) ----
    const MODULE = {
        name: 'Attendance Kiosk',
        slug: 'attendance-kiosk',
        description: 'Shared face-recognition clock-in/out kiosk devices.',
        access_type: 'ADMIN',
    };

    const [modRow] = await knex('role_permission.modules')
        .insert({ ...MODULE, created_by: 1 })
        .onConflict('slug').merge(['name', 'description', 'access_type'])
        .returning('id');
    const moduleId = modRow.id ?? modRow;

    const ACTIONS = [
        { action: 'view', prefix: 'View' },
        { action: 'create', prefix: 'Create' },
        { action: 'edit', prefix: 'Edit' },
        { action: 'delete', prefix: 'Delete' },
    ];
    const permissions = ACTIONS.map((a) => ({
        module_id: moduleId,
        action: a.action,
        name: `${a.prefix} ${MODULE.name}`,
        slug: `${MODULE.slug}:${a.action}`,
        description: `Allows you to ${a.action} the ${MODULE.name.toLowerCase()} module dashboard options.`,
        is_deleted: false,
        created_by: 1,
    }));
    await knex('role_permission.permissions')
        .insert(permissions)
        .onConflict('slug').merge(['action', 'name', 'description', 'module_id', 'is_deleted']);

    const adminRole = await knex('role_permission.roles').where({ is_deletable: false }).first();
    if (adminRole) {
        const permRows = await knex('role_permission.permissions')
            .whereIn('slug', permissions.map((p) => p.slug)).select('id');
        await knex('role_permission.role_permissions')
            .insert(permRows.map((p) => ({ role_id: adminRole.id, permission_id: p.id, created_by: 1 })))
            .onConflict(['role_id', 'permission_id']).ignore();
    }
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
    await knex.schema.withSchema('attendance').dropTableIfExists('kiosk_devices');

    const slugs = [
        'attendance-kiosk:view',
        'attendance-kiosk:create',
        'attendance-kiosk:edit',
        'attendance-kiosk:delete',
    ];
    const permRows = await knex('role_permission.permissions').whereIn('slug', slugs).select('id');
    if (permRows.length) {
        await knex('role_permission.role_permissions')
            .whereIn('permission_id', permRows.map((p) => p.id)).del();
        await knex('role_permission.permissions').whereIn('slug', slugs).del();
    }
    await knex('role_permission.modules').where({ slug: 'attendance-kiosk' }).del();
};
