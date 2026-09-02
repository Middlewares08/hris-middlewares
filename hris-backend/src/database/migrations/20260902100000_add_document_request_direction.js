/**
 * Employee-initiated document requests.
 *
 * The original portal only modelled HR asking an employee for a file. This adds
 * the reverse direction — an employee asking HR for a document (COE, ITR copy,
 * certificate of contributions, …):
 *   - `source` — 'admin' (HR → employee, the existing default) | 'employee' (employee → HR)
 *   - `declined` status + `review_remarks` / `reviewed_by` / `reviewed_at` so HR can
 *     turn a request down with a reason (mirrors payroll's payslip requests)
 *
 * Reuses the already-seeded `employee-documents:*` permissions — no seeder run.
 *
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
    await knex.schema.withSchema('employee').alterTable('document_requests', (table) => {
        table.string('source', 20).notNullable().defaultTo('admin'); // 'admin' | 'employee'
        table.string('review_remarks', 500).nullable();
        table.bigInteger('reviewed_by').unsigned().nullable()
            .references('id').inTable('employee.employees').onDelete('SET NULL');
        table.timestamp('reviewed_at', { useTz: true }).nullable();
        table.index(['source']);
    });

    // `status` is a varchar + CHECK constraint (knex `table.enum` default). Widen it
    // to allow 'declined'. Constraint name follows knex's `<table>_<column>_check`.
    await knex.raw(`
        ALTER TABLE employee.document_requests
        DROP CONSTRAINT IF EXISTS document_requests_status_check
    `);
    await knex.raw(`
        ALTER TABLE employee.document_requests
        ADD CONSTRAINT document_requests_status_check
        CHECK (status IN ('pending', 'fulfilled', 'cancelled', 'declined'))
    `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
    await knex('employee.document_requests').where('status', 'declined').update({ status: 'cancelled' });

    await knex.raw(`
        ALTER TABLE employee.document_requests
        DROP CONSTRAINT IF EXISTS document_requests_status_check
    `);
    await knex.raw(`
        ALTER TABLE employee.document_requests
        ADD CONSTRAINT document_requests_status_check
        CHECK (status IN ('pending', 'fulfilled', 'cancelled'))
    `);

    await knex.schema.withSchema('employee').alterTable('document_requests', (table) => {
        table.dropColumn('source');
        table.dropColumn('review_remarks');
        table.dropColumn('reviewed_by');
        table.dropColumn('reviewed_at');
    });
};
