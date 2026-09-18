const connection = require('../database/connection');
const JobRun = require('../database/models/system/JobRun');

/**
 * Deterministic 32-bit signed int derived from the job name, used as the key for
 * PostgreSQL advisory locks so a given job can never run concurrently — even if
 * the worker is accidentally deployed on more than one instance.
 */
const lockKey = (name) => {
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) {
        hash = (Math.imul(31, hash) + name.charCodeAt(i)) | 0;
    }
    return hash;
};

/**
 * Executes a scheduled job inside a single transaction, guarded by a transaction-
 * level advisory lock (auto-released on commit/rollback). Logs start / duration /
 * outcome and swallows errors — a failing job must never crash the worker.
 *
 * @param {string} name                         machine name of the job
 * @param {(trx: import('knex').Knex.Transaction) => Promise<any>} handler
 * @returns {Promise<any>} the handler's return value, or `{ skipped: true }`
 */
async function runJob(name, handler) {
    const startedAt = Date.now();
    console.log(`[scheduler] ${name} → starting`);

    // Heartbeat bookkeeping runs on `connection` directly, never the job's own
    // `trx` — it must survive that transaction rolling back (and, on a crash
    // mid-run, "started but never finished" is itself the useful signal for
    // health.js). Best-effort: never let bookkeeping itself fail the job.
    await JobRun.markStarted(connection, name).catch((e) => console.error(`[scheduler] ${name} → heartbeat (start) failed:`, e.message));

    try {
        const result = await connection.transaction(async (trx) => {
            const { rows } = await trx.raw('SELECT pg_try_advisory_xact_lock(?) AS locked', [lockKey(name)]);
            if (!rows[0].locked) {
                console.warn(`[scheduler] ${name} → skipped (lock held by another worker)`);
                return { skipped: true };
            }
            return handler(trx);
        });

        const ms = Date.now() - startedAt;
        console.log(`[scheduler] ${name} → done in ${ms}ms`, result && typeof result === 'object' ? JSON.stringify(result) : '');
        await JobRun.markFinished(connection, name, { status: result?.skipped ? 'skipped' : 'ok', result })
            .catch((e) => console.error(`[scheduler] ${name} → heartbeat (finish) failed:`, e.message));
        return result;
    } catch (error) {
        const ms = Date.now() - startedAt;
        console.error(`[scheduler] ${name} → FAILED after ${ms}ms:`, error);
        await JobRun.markFinished(connection, name, { status: 'error', error: error.message })
            .catch((e) => console.error(`[scheduler] ${name} → heartbeat (finish) failed:`, e.message));
        return { error: error.message };
    }
}

module.exports = { runJob, lockKey };
