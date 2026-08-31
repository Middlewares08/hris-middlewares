/**
 * Per-employee preference bag (notification opt-ins, notification channel, UI prefs).
 * Stored as a single jsonb blob on the employee row; the shape is whitelisted and
 * defaulted in the application layer (PREFERENCE_REGISTRY in auth.controller.js),
 * so no schema change is needed to add a new key later.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.withSchema('employee').alterTable('employees', (table) => {
        table.jsonb('preferences').notNullable().defaultTo('{}');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.withSchema('employee').alterTable('employees', (table) => {
        table.dropColumn('preferences');
    });
};
