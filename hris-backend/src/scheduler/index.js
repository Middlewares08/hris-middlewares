const cron = require('node-cron');

// Binds Objection → Knex for every model the jobs touch. Must load before jobs.
require('../database/connection');

const { runJob } = require('./runJob');
const autoClockOut = require('./jobs/autoClockOut');
const markAbsent = require('./jobs/markAbsent');
const backfillSchedule = require('./jobs/backfillSchedule');
const processSeparations = require('./jobs/processSeparations');
const retentionStampDocuments = require('./jobs/retentionStampDocuments');
const retentionPurgeDocuments = require('./jobs/retentionPurgeDocuments');
const retentionPurgeFaceData = require('./jobs/retentionPurgeFaceData');
const retentionPurgeLivenessSessions = require('./jobs/retentionPurgeLivenessSessions');
const retentionReconcileStorage = require('./jobs/retentionReconcileStorage');

const TIMEZONE = process.env.SCHEDULER_TIMEZONE || 'Asia/Manila';

/**
 * The job registry. Add a row here to schedule a new job — nothing else changes.
 * `cron` is a standard 5-field expression, evaluated in TIMEZONE.
 */
const schedule = [
    {
        name: 'autoClockOut',
        cron: process.env.AUTO_CLOCK_OUT_CRON || '0 2 * * *', // daily, 02:00
        handler: autoClockOut,
        description: 'Close attendance rows where the employee never clocked out.',
        staleAfterHours: 26, // 1 day + buffer
    },
    {
        name: 'markAbsent',
        cron: process.env.MARK_ABSENT_CRON || '30 2 * * *', // daily, 02:30 (after autoClockOut)
        handler: markAbsent,
        description: 'Create absent / on-leave rows for scheduled workdays with no punch.',
        staleAfterHours: 26,
    },
    {
        name: 'backfillSchedule',
        manualOnly: true, // run once via `npm run job backfillSchedule`; never on a cron
        handler: backfillSchedule,
        description: 'Stamp schedule columns on attendance rows written before the work schedule module.',
    },
    {
        name: 'processSeparations',
        cron: process.env.PROCESS_SEPARATIONS_CRON || '15 1 * * *', // daily, 01:15
        handler: processSeparations,
        description: 'Inactivate employees whose separation work cutoff (last working day) has arrived.',
        staleAfterHours: 26,
    },
    {
        name: 'retentionStampDocuments',
        cron: process.env.RETENTION_STAMP_CRON || '30 1 * * *', // daily, 01:30
        handler: retentionStampDocuments,
        description: 'Set retain_until on the documents of separated employees.',
        staleAfterHours: 26,
    },
    {
        name: 'retentionPurgeFaceData',
        cron: process.env.RETENTION_FACE_CRON || '40 1 * * *', // daily, 01:40
        handler: retentionPurgeFaceData,
        description: 'Delete facial biometrics past the post-separation grace window.',
        staleAfterHours: 26,
    },
    {
        name: 'retentionPurgeLivenessSessions',
        cron: process.env.RETENTION_LIVENESS_CRON || '45 1 * * *', // daily, 01:45
        handler: retentionPurgeLivenessSessions,
        description: 'Delete expired Face Liveness session rows.',
        staleAfterHours: 26,
    },
    {
        name: 'retentionPurgeDocuments',
        cron: process.env.RETENTION_PURGE_CRON || '50 1 * * *', // daily, 01:50
        handler: retentionPurgeDocuments,
        description: 'Purge the storage behind documents past their retention limit.',
        staleAfterHours: 26,
    },
    {
        name: 'retentionReconcileStorage',
        cron: process.env.RETENTION_RECONCILE_CRON || '0 3 * * 0', // weekly, Sun 03:00
        handler: retentionReconcileStorage,
        description: 'Reconcile the documents bucket against the DB (orphans / broken links).',
        staleAfterHours: 24 * 8, // weekly + buffer
    },
];

function start() {
    if (String(process.env.SCHEDULER_ENABLED).toLowerCase() === 'false') {
        console.log('[scheduler] disabled (SCHEDULER_ENABLED=false)');
        return [];
    }

    const tasks = [];
    for (const job of schedule) {
        if (job.manualOnly) continue; // only runnable via `npm run job <name>`
        if (!cron.validate(job.cron)) {
            console.error(`[scheduler] invalid cron "${job.cron}" for ${job.name} — not registered`);
            continue;
        }
        const task = cron.schedule(
            job.cron,
            () => runJob(job.name, job.handler),
            { timezone: TIMEZONE },
        );
        tasks.push(task);
        console.log(`[scheduler] registered ${job.name} @ "${job.cron}" (${TIMEZONE})`);
    }

    console.log(`[scheduler] up — ${tasks.length} job(s)`);
    return tasks;
}

module.exports = { start, schedule, runJob, TIMEZONE };
