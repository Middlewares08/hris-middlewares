/**
 * Pay rate no longer lives on a position — it is captured per employee via
 * payroll.employee_compensations. Drop the vestigial columns added by
 * 20260715111656_update_position_table_add_pay_rate.js (nothing reads them).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.withSchema('lookups').alterTable('positions', (table) => {
        table.dropColumn('rate_type');
        table.dropColumn('rate');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.withSchema('lookups').alterTable('positions', (table) => {
        table.enum('rate_type', ['hr', 'day']).nullable();
        table.decimal('rate', 12, 2).nullable();
    });
};
