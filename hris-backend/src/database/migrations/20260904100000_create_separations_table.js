/**
 * Employee separations — the offboarding record that powers turnover / tenure /
 * separation reporting. Until now the only signal an employee had left was the
 * `employee.employees.is_active` flag (no date, no reason, no type).
 *
 * One row per separation event. Recording a separation flips the employee to
 * inactive (done in the controller txn); soft-deleting it reverses that when no
 * other active separation remains.
 *
 * Mirrors the audit / soft-delete shape used across the schema
 * (see 20260828140000_create_overtime_requests.js).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.raw('CREATE SCHEMA IF NOT EXISTS employee');
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await knex.schema.withSchema('employee').createTable('separations', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        table.bigInteger('employee_id').unsigned().notNullable()
            .references('id').inTable('employee.employees')
            .onDelete('CASCADE');

        // Effective date the employment ends / ended
        table.date('separation_date').notNullable();
        // Last day the employee actually reports for work (may precede separation_date)
        table.date('last_working_day').nullable();
        // Date the employee / company served notice
        table.date('notice_date').nullable();

        table.enum('separation_type', [
            'resignation',
            'termination',
            'end_of_contract',
            'retirement',
            'redundancy',
            'death',
            'other',
        ]).notNullable();

        // Voluntary (employee-initiated) vs involuntary — drives the turnover split.
        table.boolean('is_voluntary').notNullable().defaultTo(true);

        table.string('reason', 500).nullable();
        table.string('remarks', 500).nullable();
        table.boolean('eligible_for_rehire').notNullable().defaultTo(true);

        table.boolean('is_deleted').notNullable().defaultTo(false);
        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');
        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');

        table.timestamps(true, true);

        table.index(['employee_id', 'is_deleted']);
        table.index(['separation_date']);
        table.index(['separation_type']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.withSchema('employee').dropTableIfExists('separations');
};
