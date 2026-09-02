require('dotenv').config();

/* ============================================================
 * Data-retention policy — the single source of truth for "how long do we keep
 * it, and when does it go". These numbers are enforced by the scheduler jobs
 * under src/scheduler/jobs/retention*.js.
 *
 * The legal basis for each figure is documented in the "Backup & Retention
 * Policy" reference. Every value is env-overridable so the policy can be tuned
 * without a deploy.
 * ========================================================== */

const int = (v, d) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : d;
};

/**
 * Master safety switch. While false, the destructive retention jobs run in
 * REPORT-ONLY mode — they log exactly what they would delete and touch nothing.
 * Flip to true only once S3 Versioning + an off-account backup copy are in place
 * (so a mistaken purge is recoverable).
 */
const PURGE_ENABLED = String(process.env.RETENTION_PURGE_ENABLED).toLowerCase() === 'true';

/**
 * Document retention horizons, in YEARS past the employee's separation date.
 *   payroll    — BIR keeps books of account & payroll support 10 years
 *   employment — DOLE requires employment records be kept 3 years
 *   identity   — government IDs, clearances; no basis to keep them longer
 *   misc       — anything unclassified
 * Documents of ACTIVE employees are retained for the duration of employment.
 */
const DOCUMENT_CLASSES = {
    payroll: int(process.env.RETENTION_DOC_PAYROLL_YEARS, 10),
    employment: int(process.env.RETENTION_DOC_EMPLOYMENT_YEARS, 3),
    identity: int(process.env.RETENTION_DOC_IDENTITY_YEARS, 3),
    misc: int(process.env.RETENTION_DOC_MISC_YEARS, 3),
};
const DEFAULT_DOCUMENT_CLASS = 'misc';

/**
 * Facial biometrics are deleted this many days after separation. The declared
 * purpose (attendance verification) ends at separation; the grace window only
 * covers a fast rehire or a dispute.
 */
const FACE_SEPARATION_GRACE_DAYS = int(process.env.RETENTION_FACE_GRACE_DAYS, 30);

/** Liveness-challenge rows are audit ephemera. 0 disables the purge. */
const LIVENESS_SESSION_TTL_DAYS = int(process.env.RETENTION_LIVENESS_TTL_DAYS, 90);

/**
 * A soft-deleted ("archived") document is hard-purged from S3 this many days
 * after archival — unless it is still inside its retain_until window.
 */
const ARCHIVED_DOCUMENT_GRACE_DAYS = int(process.env.RETENTION_ARCHIVE_GRACE_DAYS, 90);

/**
 * The storage reconciler ignores objects younger than this — they may belong to
 * an upload whose DB row is still mid-transaction.
 */
const ORPHAN_OBJECT_GRACE_DAYS = int(process.env.RETENTION_ORPHAN_GRACE_DAYS, 7);

/**
 * Documentation only — the maximum time a purged record can still exist inside a
 * backup before it ages out. Surface this number in the privacy notice.
 */
const BACKUP_RETENTION_DAYS = int(process.env.RETENTION_BACKUP_DAYS, 90);

/** Years to keep a document of the given class; unknown class → the default. */
const classHorizonYears = (cls) =>
    DOCUMENT_CLASSES[cls] ?? DOCUMENT_CLASSES[DEFAULT_DOCUMENT_CLASS];

module.exports = {
    PURGE_ENABLED,
    DOCUMENT_CLASSES,
    DEFAULT_DOCUMENT_CLASS,
    FACE_SEPARATION_GRACE_DAYS,
    LIVENESS_SESSION_TTL_DAYS,
    ARCHIVED_DOCUMENT_GRACE_DAYS,
    ORPHAN_OBJECT_GRACE_DAYS,
    BACKUP_RETENTION_DAYS,
    classHorizonYears,
};
