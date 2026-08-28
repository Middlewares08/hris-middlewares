/**
 * Overtime filing + approval. Mirrors attendance.leave_requests: employee files,
 * a manager approves/rejects, and the payroll engine credits approved hours for
 * the covered period (OT_REG component, flat multiplier).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    await knex.raw('CREATE SCHEMA IF NOT EXISTS attendance');
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await knex.schema.withSchema('attendance').createTable('overtime_requests', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        table.bigInteger('employee_id').unsigned().notNullable()
            .references('id').inTable('employee.employees')
            .onDelete('CASCADE');

        // The day the overtime was / will be worked
        table.date('work_date').notNullable();
        // Overtime hours claimed (quarter-hour precision)
        table.decimal('hours', 5, 2).notNullable();

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

        table.timestamps(true, true);

        table.index(['employee_id', 'is_deleted']);
        table.index(['status']);
        table.index(['work_date']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
    await knex.schema.withSchema('attendance').dropTableIfExists('overtime_requests');
};
