/**
 * Data-retention scaffolding for the two S3-backed data classes.
 *
 *   employee.documents          — retention_class + retain_until drive the
 *                                 document-purge job; deleted_at / purged_at
 *                                 make the archive → hard-delete lifecycle
 *                                 observable and auditable.
 *   attendance.face_enrollments — purged_at records that a retention job (not a
 *                                 human) removed the biometric.
 *
 * This migration deletes NO data. Enforcement lives in the scheduler jobs under
 * src/scheduler/jobs/retention*.js and stays in report-only mode until
 * RETENTION_PURGE_ENABLED=true. See docs: "Backup & Retention Policy".
 *
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
    await knex.schema.withSchema('employee').alterTable('documents', (table) => {
        // 'payroll' | 'employment' | 'identity' | 'misc' — maps to a retention
        // horizon in src/utils/retentionPolicy.js. NULL = not yet classified
        // (the stamping job treats it as 'misc').
        table.string('retention_class', 30).nullable();
        // Date on/after which the document may be purged. NULL until the owning
        // employee separates and the stamping job computes it.
        table.date('retain_until').nullable();
        // When the row was soft-deleted (archived). Back-filled from updated_at.
        table.timestamp('deleted_at', { useTz: true }).nullable();
        // When a retention job hard-deleted the underlying S3 object. The row is
        // kept (file_link nulled) so the audit trail survives the purge.
        table.timestamp('purged_at', { useTz: true }).nullable();
        table.index(['retain_until']);
    });

    // Start the archive grace-period clock from a sane value for rows that are
    // already soft-deleted, rather than "now".
    await knex('employee.documents')
        .where('is_deleted', true)
        .whereNull('deleted_at')
        .update({ deleted_at: knex.raw('updated_at') });

    await knex.schema.withSchema('attendance').alterTable('face_enrollments', (table) => {
        table.timestamp('purged_at', { useTz: true }).nullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
    await knex.schema.withSchema('employee').alterTable('documents', (table) => {
        table.dropColumn('retention_class');
        table.dropColumn('retain_until');
        table.dropColumn('deleted_at');
        table.dropColumn('purged_at');
    });
    await knex.schema.withSchema('attendance').alterTable('face_enrollments', (table) => {
        table.dropColumn('purged_at');
    });
};
