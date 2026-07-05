exports.up = function(knex) {
    // 💡 Added "return" here
    return knex.schema.withSchema('role_permission').alterTable('roles', function(table) {
        table.boolean('is_deleted').defaultTo(false).notNullable();
    });
};

exports.down = function(knex) {
    // 💡 Added "return" here
    return knex.schema.withSchema('role_permission').alterTable('roles', function(table) {
        table.dropColumn('is_deleted');
    });
};