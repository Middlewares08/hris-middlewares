/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    //  Add the slug column as nullable inside the lookups schema
    await knex.schema.withSchema('lookups').alterTable('departments', (table) => {
        table.string('slug').nullable();
    });

    // target "lookups".departments inside the raw SQL string
    await knex.raw(`
        UPDATE "lookups"."departments" 
        SET slug = lower(regexp_replace(regexp_replace(trim(name), '[^a-zA-Z0-9 ]', '', 'g'), '\\s+', '-', 'g'))
        WHERE slug IS NULL;
    `);

    // Apply the final NOT NULL and UNIQUE constraints
    await knex.schema.withSchema('lookups').alterTable('departments', (table) => {
        table.string('slug').notNullable().unique().alter();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.withSchema('lookups').alterTable('departments', (table) => {
        table.dropColumn('slug');
    });
};