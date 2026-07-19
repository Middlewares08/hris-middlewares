/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.withSchema('employee').createTable('government_details', (table) => {
        // 🎯 Primary key & Foreign Key linking directly to employee.employees
        table.bigInteger('employee_id')
            .primary()
            .references('id')
            .inTable('employee.employees')
            .onDelete('CASCADE');

        // Government Identifiers
        table.string('tin_number', 12).unique().nullable();
        table.string('sss_number', 10).unique().nullable();
        table.string('philhealth_number', 12).unique().nullable();
        table.string('pagibig_number', 12).unique().nullable();

        // Status & Configurations
        table.boolean('is_sss_exempt').defaultTo(false).notNullable();
        table.boolean('is_philhealth_exempt').defaultTo(false).notNullable();
        table.boolean('is_pagibig_exempt').defaultTo(false).notNullable();
        
        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');

        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');

        // Timestamps (Using Knex timestamps config)
        table.timestamps(true, true); // Adds created_at and updated_at automatically
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.withSchema('employee').dropTableIfExists('government_details');
};