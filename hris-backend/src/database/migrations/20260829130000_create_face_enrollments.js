/**
 * Face Recognition — facial biometric enrollment for time & attendance.
 *
 *   - `attendance.face_enrollments` — one active reference face per employee
 *   - seeds the `face-recognition` permission module inside the migration to
 *     dodge the fragile seeder chain (same pattern as the document-portal migration)
 *
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
    await knex.raw('CREATE SCHEMA IF NOT EXISTS attendance');
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await knex.schema.withSchema('attendance').createTable('face_enrollments', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        table.bigInteger('employee_id').unsigned().notNullable()
            .references('id').inTable('employee.employees').onDelete('CASCADE');

        // S3 object key in the dedicated face bucket (FACE_S3_BUCKET)
        table.string('image_key').notNullable();
        // Reserved for a future Face Collection / 1:N kiosk mode
        table.string('rekognition_face_id').nullable();
        table.decimal('detect_confidence', 5, 2).nullable();
        // Bounding box + sharpness/brightness snapshot from DetectFaces
        table.jsonb('quality').nullable();

        table.enum('status', ['active', 'disabled']).notNullable().defaultTo('active');
        table.timestamp('consent_at', { useTz: true }).nullable();

        table.boolean('is_deleted').notNullable().defaultTo(false);
        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees').onDelete('SET NULL');
        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees').onDelete('SET NULL');
        table.timestamps(true, true);

        table.index(['employee_id', 'is_deleted']);
    });

    // At most one non-deleted enrollment per employee
    await knex.raw(`
        CREATE UNIQUE INDEX face_enrollments_one_active_per_employee
        ON attendance.face_enrollments (employee_id)
        WHERE is_deleted = false
    `);

    // ---- permission module (mirrors 01/02/03 seeders) ----
    const MODULE = {
        name: 'Face Recognition',
        slug: 'face-recognition',
        description: 'Facial biometric enrollment for time & attendance clock-in.',
        access_type: 'ADMIN',
    };

    const [modRow] = await knex('role_permission.modules')
        .insert({ ...MODULE, created_by: null })
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
        created_by: null,
    }));
    await knex('role_permission.permissions')
        .insert(permissions)
        .onConflict('slug').merge(['action', 'name', 'description', 'module_id', 'is_deleted']);

    const adminRole = await knex('role_permission.roles').where({ is_deletable: false }).first();
    if (adminRole) {
        const permRows = await knex('role_permission.permissions')
            .whereIn('slug', permissions.map((p) => p.slug)).select('id');
        await knex('role_permission.role_permissions')
            .insert(permRows.map((p) => ({ role_id: adminRole.id, permission_id: p.id, created_by: null })))
            .onConflict(['role_id', 'permission_id']).ignore();
    }
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
    await knex.schema.withSchema('attendance').dropTableIfExists('face_enrollments');

    const slugs = [
        'face-recognition:view',
        'face-recognition:create',
        'face-recognition:edit',
        'face-recognition:delete',
    ];
    const permRows = await knex('role_permission.permissions').whereIn('slug', slugs).select('id');
    if (permRows.length) {
        await knex('role_permission.role_permissions')
            .whereIn('permission_id', permRows.map((p) => p.id)).del();
        await knex('role_permission.permissions').whereIn('slug', slugs).del();
    }
    await knex('role_permission.modules').where({ slug: 'face-recognition' }).del();
};
