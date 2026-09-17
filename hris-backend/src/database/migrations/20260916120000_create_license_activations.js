/**
 * One row per completed Install Wizard run (see install.controller.js). Lets
 * an admin audit "what key activated this deployment, who was it emailed to,
 * when, and did they actually finish setting their password" from the
 * Maintenance dashboard. `product_key_encrypted` is AES-256-GCM (same
 * utils/crypto.js used for government IDs) — the API only ever returns a
 * masked form, never the plaintext.
 *
 * Lives in the `system` schema, so it's swept up (correctly — a reset is a
 * blank slate) by the "Start Fresh" full-database reset's dynamic table scan.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.withSchema('system').createTable('license_activations', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        table.text('product_key_encrypted').notNullable();
        table.string('sent_to_email', 255).notNullable();

        // The admin account this activation created — nullable so the row
        // survives even if that employee is later deleted.
        table.bigInteger('employee_id').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');

        // True when the product key was accepted unverified because
        // LICENSE_API_URL wasn't set yet (see licenseService.js stub mode).
        table.boolean('is_stub').notNullable().defaultTo(false);
        table.string('ip_address', 64).nullable();

        // Two distinct events: the first-login email went out (install completed)
        // vs. the admin actually clicked it and set their password.
        table.timestamp('sent_at').notNullable();
        table.timestamp('activated_at').nullable();

        table.timestamps(true, true);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.withSchema('system').dropTableIfExists('license_activations');
};
