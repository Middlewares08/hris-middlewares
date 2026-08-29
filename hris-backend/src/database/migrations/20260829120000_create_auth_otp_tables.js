/**
 * One-time passcodes for both authentication factors:
 *   - login_2fa       — the second step of /auth/login
 *   - password_reset  — the "forgot password" SMS flow
 *
 * Codes are never stored in the clear: only a SHA-256 hash of the 6-digit code
 * lands in `code_hash`. Rows are short-lived (see utils/otp.js) and single-use
 * (`consumed_at`).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.raw('CREATE SCHEMA IF NOT EXISTS auth');
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await knex.schema.withSchema('auth').createTable('otp_codes', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        table.bigInteger('employee_id').unsigned().notNullable()
            .references('id').inTable('employee.employees')
            .onDelete('CASCADE');

        table.enum('purpose', ['login_2fa', 'password_reset']).notNullable();

        // SHA-256 hex digest of the delivered code
        table.string('code_hash', 64).notNullable();
        // Destination the code was sent to, already masked for display (e.g. "+63••••••1234")
        table.string('destination', 40).nullable();

        table.integer('attempts').notNullable().defaultTo(0);
        table.integer('max_attempts').notNullable().defaultTo(5);

        table.timestamp('expires_at').notNullable();
        table.timestamp('consumed_at').nullable();

        table.timestamps(true, true);

        table.index(['employee_id', 'purpose']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.withSchema('auth').dropTableIfExists('otp_codes');
};
