/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    // Provision the isolated logical schema for this module
    await knex.raw('CREATE SCHEMA IF NOT EXISTS attendance');

    // Ensure extension for UUID generation is available (gen_random_uuid)
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await knex.schema.withSchema('attendance').createTable('attendance_logs', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        // Foreign key linking to the owning employee
        table.bigInteger('employee_id').unsigned().notNullable()
            .references('id').inTable('employee.employees')
            .onDelete('CASCADE');

        // The calendar day this record represents (drives the one-log-per-day rule)
        table.date('log_date').notNullable();

        table.timestamp('time_in', { useTz: true }).nullable();
        table.timestamp('time_out', { useTz: true }).nullable();

        table.enum('status', ['present', 'late', 'half_day', 'absent', 'on_leave', 'holiday'])
            .notNullable()
            .defaultTo('present');

        // Where the punch originated from (useful once biometric/mobile devices integrate)
        table.enum('source', ['web', 'mobile', 'biometric', 'manual'])
            .notNullable()
            .defaultTo('manual');

        table.string('remarks', 500).nullable();

        table.boolean('is_deleted').defaultTo(false).notNullable();
        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');

        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');

        table.timestamps(true, true);

        // One attendance record per employee per day
        table.unique(['employee_id', 'log_date']);
        table.index(['employee_id', 'is_deleted']);
        table.index(['log_date']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
    await knex.schema.withSchema('attendance').dropTableIfExists('attendance_logs');
};
