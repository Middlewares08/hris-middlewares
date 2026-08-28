/**
 * Adds a flag so the UI (and managers) can tell which attendance rows were
 * closed out by the scheduler instead of by the employee, and filter them for review.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.withSchema('attendance').table('attendance_logs', (table) => {
        table.boolean('is_auto_closed').defaultTo(false).notNullable();
        table.index(['is_auto_closed']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.withSchema('attendance').table('attendance_logs', (table) => {
        table.dropColumn('is_auto_closed');
    });
};
