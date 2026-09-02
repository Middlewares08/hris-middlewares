const { classHorizonYears, DEFAULT_DOCUMENT_CLASS } = require('../../utils/retentionPolicy');

/**
 * Stamp `retain_until` on the documents of separated employees.
 *
 * For every live, un-purged document with a NULL retain_until whose owner has an
 * active separation record, retain_until = separation_date + the class horizon.
 * Documents of active employees are left untouched (kept for the duration of
 * employment). Idempotent — the `retain_until IS NULL` filter means a re-run
 * never moves a date that's already set.
 *
 * @param {import('knex').Knex.Transaction} trx
 */
async function retentionStampDocuments(trx) {
    const candidates = await trx('employee.documents as d')
        .join('employee.separations as s', 's.employee_id', 'd.employee_id')
        .where('s.is_deleted', false)
        .andWhere('d.is_deleted', false)
        .whereNull('d.purged_at')
        .whereNull('d.retain_until')
        .select('d.id', 'd.retention_class', 's.separation_date');

    let stamped = 0;
    for (const r of candidates) {
        const cls = r.retention_class || DEFAULT_DOCUMENT_CLASS;
        const retainUntil = new Date(`${String(r.separation_date).slice(0, 10)}T00:00:00Z`);
        retainUntil.setUTCFullYear(retainUntil.getUTCFullYear() + classHorizonYears(cls));

        // eslint-disable-next-line no-await-in-loop
        await trx('employee.documents').where({ id: r.id }).update({
            retention_class: cls,
            retain_until: retainUntil.toISOString().slice(0, 10),
            updated_at: trx.fn.now(),
        });
        stamped += 1;
    }

    return { candidates: candidates.length, stamped };
}

module.exports = retentionStampDocuments;
