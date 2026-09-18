/**
 * Durable heartbeat for scheduler jobs — one row per job name, updated by
 * runJob() on every start/finish, independent of the job's own transaction
 * (so it stays accurate even when a job errors and rolls back, or the worker
 * process dies mid-run and never reaches "finished").
 *
 * This is what lets the API process notice "the worker has been dead for
 * hours" from the outside — see src/scheduler/health.js.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    await knex.schema.withSchema('system').createTable('job_runs', (table) => {
        table.string('job_name', 100).primary();

        table.timestamp('last_started_at', { useTz: true }).nullable();
        table.timestamp('last_finished_at', { useTz: true }).nullable();
        table.enum('last_status', ['running', 'ok', 'skipped', 'error']).nullable();
        table.jsonb('last_result').nullable();
        table.text('last_error').nullable();

        table.timestamps(true, true);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
    await knex.schema.withSchema('system').dropTableIfExists('job_runs');
};
