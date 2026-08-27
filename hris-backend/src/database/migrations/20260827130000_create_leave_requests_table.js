/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    // The 'attendance' schema is provisioned by create_attendance_table, but keep this
    // idempotent so the migration can run against a fresh database in isolation.
    await knex.raw('CREATE SCHEMA IF NOT EXISTS attendance');
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await knex.schema.withSchema('attendance').createTable('leave_requests', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        // The employee filing the request
        table.bigInteger('employee_id').unsigned().notNullable()
            .references('id').inTable('employee.employees')
            .onDelete('CASCADE');

        table.enum('leave_type', [
            'vacation',
            'sick',
            'emergency',
            'maternity',
            'paternity',
            'bereavement',
            'unpaid',
            'other'
        ]).notNullable();

        // Inclusive range the leave covers
        table.date('start_date').notNullable();
        table.date('end_date').notNullable();

        // Marks a single-day request as a half day (start_date must equal end_date)
        table.boolean('is_half_day').notNullable().defaultTo(false);

        // Derived, persisted for fast leave-balance aggregation (see LeaveRequest model)
        table.decimal('total_days', 5, 1).notNullable().defaultTo(0);

        table.string('reason', 500).notNullable();

        table.enum('status', ['pending', 'approved', 'rejected', 'cancelled'])
            .notNullable()
            .defaultTo('pending');

        // Approval trail
        table.bigInteger('reviewed_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');
        table.timestamp('reviewed_at', { useTz: true }).nullable();
        table.string('review_remarks', 500).nullable();

        table.boolean('is_deleted').notNullable().defaultTo(false);
        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');
        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');

        table.timestamps(true, true); // created_at, updated_at

        table.index(['employee_id', 'is_deleted']);
        table.index(['status']);
        table.index(['start_date', 'end_date']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
    await knex.schema.withSchema('attendance').dropTableIfExists('leave_requests');
};
