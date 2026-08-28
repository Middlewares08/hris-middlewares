const cron = require('node-cron');

// Binds Objection → Knex for every model the jobs touch. Must load before jobs.
require('../database/connection');

const { runJob } = require('./runJob');
const autoClockOut = require('./jobs/autoClockOut');

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
    },
];

function start() {
    if (String(process.env.SCHEDULER_ENABLED).toLowerCase() === 'false') {
        console.log('[scheduler] disabled (SCHEDULER_ENABLED=false)');
        return [];
    }

    const tasks = [];
    for (const job of schedule) {
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
