/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    await knex.schema.withSchema('employee').createTable('credentials', function(table) {
        table.bigIncrements('id').primary();
        
        // Link back to the parent employee record
        table.bigInteger('employee_id').unsigned().notNullable()
        .references('id').inTable('employee.employees').onDelete('CASCADE');

        // Unique login email identifier
        table.string('email').unique().notNullable();
        
        // Securely encrypted password hash
        table.string('password_hash').notNullable();

        // Audit Stamps
        table.bigInteger('created_by').unsigned().nullable()
        .references('id').inTable('employee.employees').onDelete('SET NULL');
        table.bigInteger('updated_by').unsigned().nullable()
        .references('id').inTable('employee.employees').onDelete('SET NULL');
        
        table.timestamps(true, true);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
    await knex.schema.withSchema('employee').dropTableIfExists('credentials');
};