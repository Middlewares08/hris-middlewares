/**
 * Switches the stored product key from reversible AES encryption to a bcrypt
 * hash — the same one-way protection as employee.credentials.password_hash.
 * Since nothing in the app ever needs the full plaintext key back (the
 * license server call happens once, at install time, straight from the
 * request body — never from this stored value), there's no reason for it to
 * be recoverable at all. `product_key_preview` (last 4 chars, plaintext) is
 * what the masked Maintenance > License display actually renders — a 4-char
 * suffix isn't a meaningful secret on its own.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.withSchema('system').alterTable('license_activations', (table) => {
        table.renameColumn('product_key_encrypted', 'product_key_hash');
        table.string('product_key_preview', 8).nullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.withSchema('system').alterTable('license_activations', (table) => {
        table.renameColumn('product_key_hash', 'product_key_encrypted');
        table.dropColumn('product_key_preview');
    });
};
