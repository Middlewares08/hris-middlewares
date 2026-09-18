// database/models/system/JobRun.js
const BaseModel = require('../BaseModel');

/**
 * One row per scheduler job name — a durable heartbeat. See the
 * 20260917120000_create_job_runs migration and src/scheduler/health.js.
 */
class JobRun extends BaseModel {
    static get tableName() { return 'system.job_runs'; }
    static get idColumn() { return 'job_name'; }

    /** Mark a job as started. `trxOrKnex` should NOT be the job's own trx —
     *  bookkeeping must survive that transaction rolling back. Plain knex
     *  query (matches the .onConflict() convention used across migrations/
     *  seeders in this repo) rather than Objection's query builder. */
    static async markStarted(trxOrKnex, jobName) {
        await trxOrKnex('system.job_runs')
            .insert({ job_name: jobName, last_started_at: new Date().toISOString(), last_status: 'running' })
            .onConflict('job_name')
            .merge(['last_started_at', 'last_status']);
    }

    /** Mark a job as finished — status is 'ok' | 'skipped' | 'error'. */
    static async markFinished(trxOrKnex, jobName, { status, result = null, error = null }) {
        await trxOrKnex('system.job_runs')
            .insert({
                job_name: jobName,
                last_finished_at: new Date().toISOString(),
                last_status: status,
                last_result: result ? JSON.stringify(result) : null,
                last_error: error,
            })
            .onConflict('job_name')
            .merge(['last_finished_at', 'last_status', 'last_result', 'last_error']);
    }

    /** All heartbeat rows, keyed by job_name. */
    static async allByJobName(trxOrKnex) {
        const rows = await trxOrKnex('system.job_runs').select('*');
        return new Map(rows.map((r) => [r.job_name, r]));
    }
}

module.exports = JobRun;
