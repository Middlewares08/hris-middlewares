/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    // The 'employee' schema already exists (initialize_hris_core), but keep this
    // idempotent so the migration can run against a fresh database in isolation.
    await knex.raw('CREATE SCHEMA IF NOT EXISTS employee');
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await knex.schema.withSchema('employee').createTable('activity_logs', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        // The employee this activity belongs to (the timeline owner)
        table.bigInteger('employee_id').unsigned().notNullable()
            .references('id').inTable('employee.employees')
            .onDelete('CASCADE');

        // Machine-readable event key, e.g. 'attendance.clock_in', 'leave.approved'
        table.string('action', 100).notNullable();

        // Broad grouping the frontend uses to pick an icon + colour tone
        table.enum('category', [
            'attendance',
            'leave',
            'payroll',
            'profile',
            'document',
            'system'
        ]).notNullable().defaultTo('system');

        // Human-readable line shown in the "Recent Activity" feed
        table.string('description', 255).notNullable();

        // Free-form contextual payload (reference ids, amounts, before/after, ...)
        table.jsonb('metadata').nullable();

        // Request provenance — handy for auditing/security
        table.string('ip_address', 45).nullable();
        table.string('user_agent', 255).nullable();

        table.boolean('is_deleted').defaultTo(false).notNullable();
        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');

        table.timestamps(true, true);

        table.index(['employee_id', 'is_deleted']);
        table.index(['employee_id', 'created_at']);
        table.index(['category']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
    await knex.schema.withSchema('employee').dropTableIfExists('activity_logs');
};
