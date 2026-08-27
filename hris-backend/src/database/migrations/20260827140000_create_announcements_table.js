/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    // Announcements live in their own dedicated schema. Keep this idempotent so the
    // migration can run against a fresh database in isolation.
    await knex.raw('CREATE SCHEMA IF NOT EXISTS announcement');
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await knex.schema.withSchema('announcement').createTable('announcements', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        table.string('title', 200).notNullable();
        table.text('body').notNullable();

        // Drives the icon + colour tone the frontend renders for the entry
        table.enum('priority', ['info', 'important', 'urgent'])
            .notNullable()
            .defaultTo('info');

        // draft  -> not visible to employees
        // published -> visible in the employee feed (subject to the publish / expiry window)
        // archived -> retired, kept for history
        table.enum('status', ['draft', 'published', 'archived'])
            .notNullable()
            .defaultTo('draft');

        // Pinned entries float to the top of the employee feed
        table.boolean('is_pinned').notNullable().defaultTo(false);

        // When the entry becomes / became visible, and an optional auto-expiry
        table.timestamp('published_at', { useTz: true }).nullable();
        table.timestamp('expires_at', { useTz: true }).nullable();

        // Optional deep link opened from the announcement modal
        table.string('link_url', 500).nullable();

        table.boolean('is_deleted').notNullable().defaultTo(false);
        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');
        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');

        table.timestamps(true, true); // created_at, updated_at

        table.index(['status', 'is_deleted']);
        table.index(['is_pinned']);
        table.index(['published_at']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
    await knex.schema.withSchema('announcement').dropTableIfExists('announcements');
};
