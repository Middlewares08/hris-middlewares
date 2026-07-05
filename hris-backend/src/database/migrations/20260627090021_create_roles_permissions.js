// database/migrations/YYYYMMDDHHMMSS_create_roles_and_permissions.js
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    // 1. Create the custom schema namespace
    await knex.raw('CREATE SCHEMA IF NOT EXISTS role_permission');
    
    // 2. Ensure extension for UUID generation is available
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    // 3. Modules Table
    await knex.schema.withSchema('role_permission').createTable('modules', (table) => {
        table.increments('id').primary(); // Internal fast indexing
        table.uuid('uuid').notNullable().unique().defaultTo(knex.raw('gen_random_uuid()')); // Public facing API id
        table.string('name').notNullable().unique();        // e.g., "Maintenance"
        table.string('slug').notNullable().unique();        // e.g., "maintenance"
        table.string('description').nullable();
        table.string('access_type', 50).notNullable().defaultTo('ADMIN');
        
        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');
        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');
        table.timestamps(true, true);
    });

    // 4. Roles Table
    await knex.schema.withSchema('role_permission').createTable('roles', (table) => {
        table.increments('id').primary();
        table.uuid('uuid').notNullable().unique().defaultTo(knex.raw('gen_random_uuid()'));
        table.string('name').notNullable().unique();        
        table.string('slug').notNullable().unique();        
        table.string('description').nullable();
        table.string('action').nullable();

        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');
        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');
        table.timestamps(true, true);
    });

    // 5. Permissions Table (Linked to Modules Table)
    await knex.schema.withSchema('role_permission').createTable('permissions', (table) => {
        table.increments('id').primary();
        table.uuid('uuid').notNullable().unique().defaultTo(knex.raw('gen_random_uuid()'));
        table.string('name').notNullable().unique();        
        table.string('slug').notNullable().unique();  
        table.string('description').nullable();

        
        // 💡 FIX: Replaced string('module') with a foreign key reference
        table.integer('module_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('role_permission.modules')
            .onDelete('CASCADE'); // If a module is removed, cascade drop its permissions

        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');
        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');          
        table.timestamps(true, true);
    });

    // 6. Role Permissions Join Table (Many-to-Many Bridge using Integer IDs)
    await knex.schema.withSchema('role_permission').createTable('role_permissions', (table) => {
        table.increments('id').primary();
        
        table.integer('role_id')
            .unsigned()
            .references('id')
            .inTable('role_permission.roles')
            .onDelete('CASCADE');
            
        table.integer('permission_id')
            .unsigned()
            .references('id')
            .inTable('role_permission.permissions')
            .onDelete('CASCADE');

        table.unique(['role_id', 'permission_id']);

        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');
        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');
        table.timestamps(true, true);
    });

    // 7. Employee Roles Linkage Table (Linked to Employee and Roles via IDs)
    await knex.schema.withSchema('role_permission').createTable('employee_roles', (table) => {
        table.increments('id').primary();
        
        table.integer('employee_id') 
            .unsigned()
            .references('id')
            .inTable('employee.employees')
            .onDelete('CASCADE');

        table.integer('role_id')
            .unsigned()
            .references('id')
            .inTable('role_permission.roles')
            .onDelete('CASCADE');

        table.unique(['employee_id', 'role_id']);
        
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
exports.down = async function(knex) {
    await knex.schema.withSchema('role_permission').dropTableIfExists('employee_roles');
    await knex.schema.withSchema('role_permission').dropTableIfExists('role_permissions');
    await knex.schema.withSchema('role_permission').dropTableIfExists('permissions');
    await knex.schema.withSchema('role_permission').dropTableIfExists('roles');
    await knex.schema.withSchema('role_permission').dropTableIfExists('modules'); // 💡 Drop modules last
    await knex.raw('DROP SCHEMA IF EXISTS role_permission RESTRICT');
};