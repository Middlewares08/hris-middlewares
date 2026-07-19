/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.withSchema('employee').alterTable('employees', (table) => {
        // Adds a nullable profile_url string column
        table.string('profile_url', 2048).nullable(); 
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.withSchema('employee').alterTable('employees', (table) => {
        table.dropColumn('profile_url');
    });
};