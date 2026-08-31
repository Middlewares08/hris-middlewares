/**
 * `GovernmentDetail` AES-GCM encrypts tin/sss/philhealth/pagibig on write
 * (`iv:authTag:ciphertext`, ~80+ chars). Migration
 * `20260801123914_update_government_details_fields.js` shrank these columns back
 * to varchar(15/12/14/14), which is far too small to hold the ciphertext — any
 * encrypted write fails. Widen them again (mirrors `20260719161504`).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.withSchema('employee').alterTable('government_details', (table) => {
        table.string('tin_number', 255).nullable().alter();
        table.string('sss_number', 255).nullable().alter();
        table.string('philhealth_number', 255).nullable().alter();
        table.string('pagibig_number', 255).nullable().alter();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.withSchema('employee').alterTable('government_details', (table) => {
        table.string('tin_number', 15).nullable().alter();
        table.string('sss_number', 12).nullable().alter();
        table.string('philhealth_number', 14).nullable().alter();
        table.string('pagibig_number', 14).nullable().alter();
    });
};
