/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    await knex.schema.withSchema('role_permission').alterTable('modules', (table) => {
        table.boolean('is_deleted').defaultTo(false).notNullable();
    });

    await knex.schema.withSchema('role_permission').alterTable('permissions', (table) => {
        table.boolean('is_deleted').defaultTo(false).notNullable();
    });

    await knex.schema.withSchema('role_permission').alterTable('employee_roles', (table) => {
        table.boolean('is_deleted').defaultTo(false).notNullable();
    });

    await knex.schema.withSchema('role_permission').alterTable('role_permissions', (table) => {
        table.boolean('is_deleted').defaultTo(false).notNullable();
    });
};


/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
*/
exports.down = async function(knex) {
    await knex.schema.withSchema('role_permission').alterTable('modules', (table) => {
        table.dropColumn('is_deleted');
    });

    await knex.schema.withSchema('role_permission').alterTable('permissions', (table) => {
        table.boolean('is_deleted').defaultTo(false).notNullable();
    });

    await knex.schema.withSchema('role_permission').alterTable('employee_roles', (table) => {
        table.boolean('is_deleted').defaultTo(false).notNullable();
    });

    await knex.schema.withSchema('role_permission').alterTable('role_permissions', (table) => {
        table.boolean('is_deleted').defaultTo(false).notNullable();
    });
};