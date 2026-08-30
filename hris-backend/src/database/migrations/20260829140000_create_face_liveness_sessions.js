/**
 * Face Liveness sessions — one row per liveness challenge started from the PWA.
 * Lets the backend (a) bind a Rekognition SessionId to the employee who asked
 * for it, (b) reject reuse, and (c) keep an audit trail of pass/fail + score.
 *
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
    await knex.raw('CREATE SCHEMA IF NOT EXISTS attendance');
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await knex.schema.withSchema('attendance').createTable('face_liveness_sessions', (table) => {
        table.bigIncrements('id').primary();
        table.string('session_id').notNullable().unique();

        table.bigInteger('employee_id').unsigned().notNullable()
            .references('id').inTable('employee.employees').onDelete('CASCADE');

        table.enum('status', ['pending', 'passed', 'failed']).notNullable().defaultTo('pending');
        table.decimal('confidence', 5, 2).nullable();
        table.timestamp('consumed_at', { useTz: true }).nullable();

        table.timestamps(true, true);

        table.index(['employee_id', 'status']);
        table.index(['created_at']);
    });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
    await knex.schema.withSchema('attendance').dropTableIfExists('face_liveness_sessions');
};
