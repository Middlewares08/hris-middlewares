const storage = require('../../utils/storage');
const { logActivity } = require('../../utils/activityLogger');
const { PURGE_ENABLED, ARCHIVED_DOCUMENT_GRACE_DAYS } = require('../../utils/retentionPolicy');

const daysAgoIso = (n) => new Date(Date.now() - n * 86400000).toISOString();

/**
 * Hard-delete the S3 object (or legacy base64 blob) behind a document once it is
 * eligible, then null `file_link` and stamp `purged_at`. The row itself is kept
 * so the timeline / audit trail survives the purge.
 *
 * Eligible when either:
 *   (a) retain_until has passed — the retention horizon was reached; or
 *   (b) the row has been archived (is_deleted) longer than
 *       ARCHIVED_DOCUMENT_GRACE_DAYS AND is not still inside a retain_until
 *       window.
 *
 * REPORT-ONLY unless RETENTION_PURGE_ENABLED=true: logs each candidate and
 * returns without deleting anything.
 *
 * @param {import('knex').Knex.Transaction} trx
 */
async function retentionPurgeDocuments(trx) {
    const today = new Date().toISOString().slice(0, 10);
    const archiveCutoff = daysAgoIso(ARCHIVED_DOCUMENT_GRACE_DAYS);

    const candidates = await trx('employee.documents')
        .whereNull('purged_at')
        .whereNotNull('file_link')
        .andWhere((qb) => {
            qb.where((w) => {
                w.whereNotNull('retain_until').andWhere('retain_until', '<', today);
            }).orWhere((w) => {
                w.where('is_deleted', true)
                    .andWhere(trx.raw('COALESCE(deleted_at, updated_at)'), '<', archiveCutoff)
                    .andWhere((r) => {
                        r.whereNull('retain_until').orWhere('retain_until', '<', today);
                    });
            });
        })
        .select(
            'id', 'employee_id', 'label', 'file_link',
            'retention_class', 'retain_until', 'is_deleted',
        );

    if (!PURGE_ENABLED) {
        for (const d of candidates) {
            console.log(
                `[retention] would purge document #${d.id} ("${d.label}") — `
                + `class=${d.retention_class || 'misc'} retain_until=${d.retain_until || '-'} archived=${d.is_deleted}`,
            );
        }
        return { mode: 'report-only', candidates: candidates.length, purged: 0 };
    }

    let purged = 0;
    for (const d of candidates) {
        if (storage.isStoredKey(d.file_link)) {
            // eslint-disable-next-line no-await-in-loop
            await storage.deleteObject(d.file_link); // best-effort, never throws
        }
        // eslint-disable-next-line no-await-in-loop
        await trx('employee.documents').where({ id: d.id }).update({
            file_link: null,
            is_deleted: true,
            deleted_at: trx.raw('COALESCE(deleted_at, now())'),
            purged_at: trx.fn.now(),
            updated_at: trx.fn.now(),
        });
        // eslint-disable-next-line no-await-in-loop
        await logActivity({
            employeeId: d.employee_id,
            action: 'document.retention_purged',
            category: 'document',
            description: `Document "${d.label}" reached its retention limit and was purged.`,
            metadata: {
                document_id: d.id,
                retention_class: d.retention_class,
                retain_until: d.retain_until,
            },
        }, trx);
        purged += 1;
    }

    return { mode: 'enforced', candidates: candidates.length, purged };
}

module.exports = retentionPurgeDocuments;
