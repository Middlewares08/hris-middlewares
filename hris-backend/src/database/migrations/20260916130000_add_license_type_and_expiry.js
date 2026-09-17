/**
 * Adds license type + expiration to `system.license_activations` (see
 * 20260916120000_create_license_activations.js). Both come from the license
 * validation response (licenseService.js) — `license_type` is a free-text
 * label from whatever the license server returns, `expires_at` null means
 * perpetual/never-expires.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.withSchema('system').alterTable('license_activations', (table) => {
        table.string('license_type', 100).nullable();
        table.timestamp('expires_at').nullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.withSchema('system').alterTable('license_activations', (table) => {
        table.dropColumn('license_type');
        table.dropColumn('expires_at');
    });
};
