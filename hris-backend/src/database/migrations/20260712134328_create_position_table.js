/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.withSchema('lookups').createTable('positions', (table) => {
        table.increments('id').primary();
        
        // 🎯 FIX: Changed from SQLite syntax to native PostgreSQL UUID generator
        table.string('uuid').notNullable().unique().defaultTo(knex.raw('gen_random_uuid()')); 
        
        table.string('slug').notNullable().unique();
        table.string('name', 100).notNullable();
        table.string('code', 50).nullable();
        table.text('description').nullable();
        
        table.integer('department_id').unsigned().notNullable()
            .references('id').inTable('lookups.departments')
            .onDelete('CASCADE');

        table.boolean('is_deleted').defaultTo(false).notNullable();
        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');

        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');
        table.timestamps(true, true); 
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.withSchema('lookups').dropTableIfExists('positions');
};