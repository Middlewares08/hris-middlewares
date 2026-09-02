const storage = require('../../utils/storage');
const { PURGE_ENABLED, ORPHAN_OBJECT_GRACE_DAYS } = require('../../utils/retentionPolicy');

/**
 * Cross-check the documents bucket against the DB, both directions:
 *
 *   - S3 object with no live DB row, older than the grace period → an orphan.
 *     Deleted only when RETENTION_PURGE_ENABLED=true; otherwise just logged.
 *   - Live DB row whose S3 object is missing → a broken link. Always only
 *     logged — a human needs to decide whether to restore or drop it.
 *
 * The face bucket is small and fully event-driven, so it is not swept here.
 *
 * @param {import('knex').Knex.Transaction} trx
 */
async function retentionReconcileStorage(trx) {
    if (!storage.S3_BUCKET) return { skipped: 'AWS_S3_BUCKET not configured' };

    const cutoff = Date.now() - ORPHAN_OBJECT_GRACE_DAYS * 86400000;

    let objects;
    try {
        objects = await storage.listAllKeys();
    } catch (err) {
        if (err.name === 'AccessDenied') {
            console.warn('[retention] reconcile skipped — IAM user lacks s3:ListBucket on the documents bucket');
            return { skipped: 'missing s3:ListBucket permission' };
        }
        throw err;
    }

    const persistedLinks = await trx('employee.documents')
        .whereNotNull('file_link')
        .pluck('file_link');
    const dbKeys = new Set(persistedLinks.filter(storage.isStoredKey));

    const orphans = objects.filter(
        (o) => !dbKeys.has(o.key) && new Date(o.lastModified).getTime() < cutoff,
    );

    // Broken links — live rows pointing at a key that no longer exists in S3.
    const liveRows = await trx('employee.documents')
        .where('is_deleted', false)
        .whereNotNull('file_link')
        .select('id', 'file_link');

    const broken = [];
    for (const r of liveRows) {
        if (!storage.isStoredKey(r.file_link)) continue;
        // eslint-disable-next-line no-await-in-loop
        if (!(await storage.objectExists(r.file_link))) broken.push(r.id);
    }

    let orphansDeleted = 0;
    if (PURGE_ENABLED) {
        for (const o of orphans) {
            // eslint-disable-next-line no-await-in-loop
            await storage.deleteObject(o.key);
            orphansDeleted += 1;
        }
    } else {
        for (const o of orphans) console.log(`[retention] orphan object (would delete): ${o.key}`);
    }
    for (const id of broken) {
        console.warn(`[retention] document #${id} points at a missing S3 object`);
    }

    return {
        mode: PURGE_ENABLED ? 'enforced' : 'report-only',
        objects: objects.length,
        orphans: orphans.length,
        orphansDeleted,
        brokenLinks: broken.length,
    };
}

module.exports = retentionReconcileStorage;
