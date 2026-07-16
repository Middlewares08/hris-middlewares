/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.withSchema('lookups').alterTable('positions', (table) => {
        // Enforce the rate_type to only allow 'per Hour' or 'per Day'
        table.enum('rate_type', ['hr', 'day']).nullable();
        table.decimal('rate', 12, 2).nullable(); // Supports up to 9,999,999,999.99
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.withSchema('lookups').alterTable('positions', (table) => {
        table.dropColumn('rate_type');
        table.dropColumn('rate');
    });
};