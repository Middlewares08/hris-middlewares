/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    // 1. CORE EMPLOYEES TABLE
    await knex.schema.withSchema('employee').createTable('employees', function(table) {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('uuid_generate_v4()')).unique().index();
        
        // Full Name Architecture
        table.string('first_name').notNullable();
        table.string('middle_name').nullable();
        table.string('last_name').notNullable();
        table.string('preferred_name').nullable(); // Nickname
        
        table.boolean('is_active').defaultTo(true);
        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL'); // Prevents errors if a managing employee is ever deleted

        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');
        table.timestamps(true, true);
    });

    // 2. CONTACT INFORMATION TABLE (1:1 Relationship)
    await knex.schema.withSchema('employee').createTable('employee_contacts', function(table) {
        table.bigIncrements('id').primary();
        // Foreign Key mapping back to core employee
        table.bigInteger('employee_id').unsigned().notNullable()
        .references('id').inTable('employee.employees').onDelete('CASCADE');

        table.string('personal_email').unique().notNullable();
        table.string('personal_phone').notNullable();
        
        // Emergency Contact Sub-boundary
        table.string('emergency_contact_name').notNullable();
        table.string('emergency_contact_relationship').notNullable();
        table.string('emergency_contact_phone').notNullable();

        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL'); // Prevents errors if a managing employee is ever deleted

        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');
        table.timestamps(true, true);
    });

    // 3. DEMOGRAPHIC DATA TABLE (1:1 Relationship)
    await knex.schema.withSchema('employee').createTable('employee_demographics', function(table) {
        table.bigIncrements('id').primary();
        table.bigInteger('employee_id').unsigned().notNullable()
        .references('id').inTable('employee.employees').onDelete('CASCADE');

        table.date('date_of_birth').notNullable();
        table.string('gender').notNullable(); // Inclusive handling via application layer validation
        table.string('nationality').notNullable();

        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL'); // Prevents errors if a managing employee is ever deleted

        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');
        table.timestamps(true, true);
    });

    // 4. ADDRESSES TABLE (1:Many Relationship for maximum flexibility)
    await knex.schema.withSchema('employee').createTable('employee_addresses', function(table) {
        table.bigIncrements('id').primary();
        table.bigInteger('employee_id').unsigned().notNullable()
        .references('id').inTable('employee.employees').onDelete('CASCADE');

        // Differentiates 'current' vs 'permanent'
        table.enum('address_type', ['current', 'permanent']).notNullable(); 
        
        table.string('street_address').notNullable();
        table.string('city').notNullable();
        table.string('state_province').notNullable();
        table.string('postal_code').notNullable();
        table.string('country').notNullable();

        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL'); // Prevents errors if a managing employee is ever deleted

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
exports.down = async function(knex) {
    // Drop in reverse order to respect foreign key constraints
    await knex.schema.withSchema('employee').dropTableIfExists('employee_addresses');
    await knex.schema.withSchema('employee').dropTableIfExists('employee_demographics');
    await knex.schema.withSchema('employee').dropTableIfExists('employee_contacts');
    await knex.schema.withSchema('employee').dropTableIfExists('employees');
};