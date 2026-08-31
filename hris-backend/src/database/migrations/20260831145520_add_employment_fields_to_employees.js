/**
 * The Add-Employee wizard collects `date_hired` and `employment_type` but nothing
 * persisted them. Add the columns so the hire date can drive the employee_id year
 * and the compensation effective_date.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.withSchema('employee').alterTable('employees', (table) => {
        table.date('date_hired').nullable();
        table.string('employment_type', 30).nullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.withSchema('employee').alterTable('employees', (table) => {
        table.dropColumn('date_hired');
        table.dropColumn('employment_type');
    });
};
