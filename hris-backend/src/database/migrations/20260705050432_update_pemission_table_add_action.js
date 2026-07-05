/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    await knex.schema.withSchema('role_permission').alterTable('permissions', (table) => {
        table.string('action').notNullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
    await knex.schema.withSchema('role_permission').alterTable('permissions', (table) => {
        table.string('action').notNullable();
    });
};
