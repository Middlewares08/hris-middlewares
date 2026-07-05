/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    await knex.schema.withSchema('role_permission').alterTable('roles', (table) => {
        // 💡 Adds the type classification directly to the role assignment junction
        table.boolean('is_deletable').defaultTo(true).notNullable();
    });
};


/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
*/
exports.down = async function(knex) {
    await knex.schema.withSchema('role_permission').alterTable('roles', (table) => {
        table.dropColumn('is_deletable');
    });
};