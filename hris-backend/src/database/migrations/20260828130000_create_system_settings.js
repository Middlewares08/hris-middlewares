/**
 * Generic key/value application settings — the home for runtime feature flags
 * (e.g. `overtime.enabled`) that an admin can toggle without a redeploy.
 *
 * Seeded here (not in /seeders) so the baseline rows land exactly once and never
 * trip the fragile seeder chain.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    await knex.raw('CREATE SCHEMA IF NOT EXISTS system');
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await knex.schema.withSchema('system').createTable('settings', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        // Dotted identifier, e.g. 'overtime.enabled'
        table.string('key', 100).notNullable().unique();
        // Always an object: { value: <any> } — keeps the column type stable
        table.jsonb('value').notNullable();
        table.string('description', 300).nullable();
        // Whitelisted for the authenticated-employee endpoint (GET /system/settings/public)
        table.boolean('is_public').notNullable().defaultTo(false);

        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');

        table.timestamps(true, true);
    });

    await knex('system.settings').insert([
        {
            key: 'overtime.enabled',
            value: JSON.stringify({ value: true }),
            description: 'Master switch for the Overtime module — filing, approvals, and payroll crediting.',
            is_public: true,
        },
    ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
    await knex.schema.withSchema('system').dropTableIfExists('settings');
};
