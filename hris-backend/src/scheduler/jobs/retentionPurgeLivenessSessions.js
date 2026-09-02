const { LIVENESS_SESSION_TTL_DAYS } = require('../../utils/retentionPolicy');

/**
 * Delete Face Liveness session rows older than LIVENESS_SESSION_TTL_DAYS. These
 * hold no image data — only a session id, a pass/fail verdict and a score — so
 * they are audit ephemera and are hard-deleted regardless of the purge switch.
 * Set RETENTION_LIVENESS_TTL_DAYS=0 to disable.
 *
 * @param {import('knex').Knex.Transaction} trx
 */
async function retentionPurgeLivenessSessions(trx) {
    if (!LIVENESS_SESSION_TTL_DAYS) return { deleted: 0, disabled: true };

    const cutoff = new Date(Date.now() - LIVENESS_SESSION_TTL_DAYS * 86400000).toISOString();
    const deleted = await trx('attendance.face_liveness_sessions')
        .where('created_at', '<', cutoff)
        .del();

    return { deleted, ttlDays: LIVENESS_SESSION_TTL_DAYS };
}

module.exports = retentionPurgeLivenessSessions;
