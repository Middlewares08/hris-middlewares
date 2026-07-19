/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.withSchema('employee').alterTable('government_details', (table) => {
        // 🎯 Removed .unique() so it only alters character limit and nullability
        table.string('tin_number', 15).nullable().alter();
        table.string('sss_number', 12).nullable().alter();
        table.string('philhealth_number', 14).nullable().alter();
        table.string('pagibig_number', 14).nullable().alter();
    }); 
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.withSchema('employee').alterTable('government_details', (table) => {
        table.string('tin_number', 12).nullable().alter();
        table.string('sss_number', 10).nullable().alter();
        table.string('philhealth_number', 12).nullable().alter();
        table.string('pagibig_number', 12).nullable().alter();
    }); 
};