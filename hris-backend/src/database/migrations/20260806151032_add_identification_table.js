/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.withSchema('employee').createTable('documents', (table) => {
        table.bigIncrements('id').primary();
        
        // Foreign key linking to your existing employees table
        table.bigInteger('employee_id').unsigned().notNullable()
             .references('id').inTable('employee.employees').onDelete('CASCADE');
             
        table.string('label').notNullable(); // e.g. "Resume", "Government ID", "Medical Record"
        table.enum('type', ['pdf', 'image']).notNullable();
        table.text('file_link').notNullable();
        
        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');

        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');
            
        table.boolean('is_deleted').defaultTo(false); // Matching your deletion strategy
        table.timestamps(true, true); // created_at, updated_at
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.withSchema('employee').dropTableIfExists('documents');
};
