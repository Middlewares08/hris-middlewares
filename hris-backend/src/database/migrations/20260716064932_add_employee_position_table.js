/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.withSchema('employee').createTable('positions', (table) => {
        // 1. Foreign Key referencing 'employees'
        table.integer('employee_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('employee.employees')
            .onDelete('CASCADE'); // If an employee is deleted, clean up this link

        // 2. Foreign Key referencing 'lookups.positions'
        table.integer('position_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('lookups.positions')
            .onDelete('CASCADE'); // If a position is deleted, clean up this link

        // Composite Primary Key (prevents duplicate employee-position pairings)
        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');

        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');
        table.primary(['employee_id', 'position_id']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.withSchema('employee').dropTableIfExists('positions');
};