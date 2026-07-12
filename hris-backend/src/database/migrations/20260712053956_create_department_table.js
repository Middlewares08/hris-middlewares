/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    // Create the custom schema namespace
    await knex.raw('CREATE SCHEMA IF NOT EXISTS lookups');
    
    // Ensure extension for UUID generation is available (gen_random_uuid)
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    return knex.schema.withSchema('lookups').createTable('departments', (table) => {
        table.increments('id').primary();
        // 🎯 FIX: Changed to gen_random_uuid() to match pgcrypto
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();
        table.string('name', 150).notNullable(); // 🎯 FIX: Removed duplicate 'name' line below this
        table.string('code', 50).notNullable().unique();
        table.string('description', 500).nullable();
        
        table.boolean('is_deleted').defaultTo(false).notNullable();
        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');

        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');

        table.timestamps(true, true);
        
        table.index(['code', 'is_deleted']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.withSchema('lookups').dropTableIfExists('departments');
};