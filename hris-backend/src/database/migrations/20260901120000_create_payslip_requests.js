/**
 * Payslip requests — an employee asks HR for an official / downloadable copy of one of
 * their released payslips, stating a purpose (loan, visa, records ...). An admin reviews
 * it under Payroll and fulfils or rejects it. Mirrors attendance.overtime_requests.
 *
 * Reuses the already-seeded `run-payroll:*` permission slugs — no seeder run required.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.raw('CREATE SCHEMA IF NOT EXISTS payroll');
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await knex.schema.withSchema('payroll').createTable('payslip_requests', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        // The employee filing the request
        table.bigInteger('employee_id').unsigned().notNullable()
            .references('id').inTable('employee.employees')
            .onDelete('CASCADE');

        // The released payslip a copy is being requested for
        table.bigInteger('payslip_id').unsigned().notNullable()
            .references('id').inTable('payroll.payslips')
            .onDelete('RESTRICT');

        // Why the copy is needed
        table.string('reason', 500).notNullable();

        table.enum('status', ['pending', 'fulfilled', 'rejected', 'cancelled'])
            .notNullable()
            .defaultTo('pending');

        // Review trail
        table.bigInteger('reviewed_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');
        table.timestamp('reviewed_at', { useTz: true }).nullable();
        table.string('review_remarks', 500).nullable();
        table.timestamp('fulfilled_at', { useTz: true }).nullable();

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
        table.index(['payslip_id']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.withSchema('payroll').dropTableIfExists('payslip_requests');
};
