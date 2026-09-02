const storage = require('../../utils/storage');
const { deleteFace } = require('../../utils/rekognition');
const { logActivity } = require('../../utils/activityLogger');
const { PURGE_ENABLED, FACE_SEPARATION_GRACE_DAYS } = require('../../utils/retentionPolicy');

const FACE_BUCKET_OPTS = { bucket: storage.FACE_S3_BUCKET, prefix: storage.FACE_S3_KEY_PREFIX };
const daysAgoYmd = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

/**
 * Delete facial biometrics for employees separated more than
 * FACE_SEPARATION_GRACE_DAYS ago — the S3 reference image, the Rekognition
 * collection face, and the enrollment row (soft-deleted + `purged_at` stamped).
 *
 * Biometrics have no post-employment retention basis, so this is a full delete
 * rather than an archive.
 *
 * REPORT-ONLY unless RETENTION_PURGE_ENABLED=true.
 *
 * @param {import('knex').Knex.Transaction} trx
 */
async function retentionPurgeFaceData(trx) {
    const cutoff = daysAgoYmd(FACE_SEPARATION_GRACE_DAYS);

    const rows = await trx('attendance.face_enrollments as f')
        .join('employee.separations as s', 's.employee_id', 'f.employee_id')
        .where('s.is_deleted', false)
        .andWhere('s.separation_date', '<=', cutoff)
        .andWhere('f.is_deleted', false)
        .select(
            'f.id', 'f.uuid', 'f.employee_id', 'f.image_key',
            'f.rekognition_face_id', 's.separation_date',
        );

    if (!PURGE_ENABLED) {
        for (const r of rows) {
            console.log(
                `[retention] would purge face enrollment ${r.uuid} for employee ${r.employee_id} `
                + `(separated ${String(r.separation_date).slice(0, 10)})`,
            );
        }
        return { mode: 'report-only', candidates: rows.length, purged: 0 };
    }

    let purged = 0;
    for (const r of rows) {
        // eslint-disable-next-line no-await-in-loop
        await storage.deleteObject(r.image_key, FACE_BUCKET_OPTS);
        // eslint-disable-next-line no-await-in-loop
        if (r.rekognition_face_id) await deleteFace(r.rekognition_face_id);
        // eslint-disable-next-line no-await-in-loop
        await trx('attendance.face_enrollments').where({ id: r.id }).update({
            is_deleted: true,
            status: 'disabled',
            purged_at: trx.fn.now(),
            updated_at: trx.fn.now(),
        });
        // eslint-disable-next-line no-await-in-loop
        await logActivity({
            employeeId: r.employee_id,
            action: 'face.retention_purged',
            category: 'profile',
            description: 'Facial biometric purged — retention window after separation elapsed.',
            metadata: {
                face_enrollment_uuid: r.uuid,
                separation_date: String(r.separation_date).slice(0, 10),
            },
        }, trx);
        purged += 1;
    }

    return { mode: 'enforced', candidates: rows.length, purged };
}

module.exports = retentionPurgeFaceData;
