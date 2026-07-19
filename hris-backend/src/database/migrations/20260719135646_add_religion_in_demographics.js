/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    // 1. Alter demographics table
    await knex.schema.withSchema('employee').alterTable('demographics', (table) => {
        table.string('religion', 2048).nullable(); 
    });

    // 2. Structural changes to the addresses table (Executed sequentially)
    await knex.schema.withSchema('employee').alterTable('addresses', (table) => {
        // REMOVE / DROP OLD COLUMNS
        table.dropColumn('address_type');
        table.dropColumn('country');

        // ADD NEW COLUMNS
        table.string('barangay', 2048).nullable(); 
        table.string('region', 2048).nullable(); 

        // UPDATE EXISTING COLUMNS TO BE NULLABLE
        table.string('street_address').nullable().alter(); 
        table.string('city').nullable().alter();
        table.string('state_province').nullable().alter();
        table.string('postal_code').nullable().alter();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
    // 1. Revert changes to the addresses table
    await knex.schema.withSchema('employee').alterTable('addresses', (table) => {
        // REMOVE NEW COLUMNS ADDED IN THE UP BLOCK
        table.dropColumn('barangay');
        table.dropColumn('region');

        // RE-CREATE COLUMNS THAT WERE DROPPED IN THE UP BLOCK
        table.string('address_type').nullable(); 
        table.string('country').notNullable();

        // REVERT MODIFIED COLUMNS BACK TO NOT NULLABLE
        table.string('street_address').notNullable().alter();
        table.string('city').notNullable().alter();
        table.string('state_province').notNullable().alter();
        table.string('postal_code').notNullable().alter();
    });

    // 2. Revert changes to the demographics table
    await knex.schema.withSchema('employee').alterTable('demographics', (table) => {
        table.dropColumn('religion');
    });
};