/**
 * Dead-man's-switch for the scheduler.
 *
 * The worker process (src/worker.js) can die silently — no request fails, no
 * user notices, and the jobs it would have run (autoClockOut, markAbsent,
 * retention purges, ...) just stop happening. A cron check registered inside
 * the worker itself can't catch this: if the worker is dead, that check never
 * fires either.
 *
 * So this runs from the API process instead (see server.js) — the process
 * that's actually being used, and therefore the one most likely to still be
 * up. It compares each cron job's last-finished heartbeat (system.job_runs,
 * written by runJob() independently of the job's own transaction) against a
 * per-job staleness threshold, and emails ADMIN_CONTACT_EMAIL when one has
 * gone quiet.
 *
 * Re-alert cooldown (so a still-broken worker doesn't spam an email every
 * check) is tracked using the *same* job_runs table under a synthetic job
 * name — no new table, no new system.settings key.
 */
const JobRun = require('../database/models/system/JobRun');
const { sendMail } = require('../utils/mailer');
const { schedule } = require('./index');

const ALERT_MARKER = '__scheduler_health_alert__';
const REALERT_COOLDOWN_HOURS = Number(process.env.SCHEDULER_HEALTH_REALERT_HOURS) || 12;
const ADMIN_INBOX = process.env.ADMIN_CONTACT_EMAIL || process.env.MAIL_FROM || 'admin@hris.local';

const hoursSince = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / 3_600_000 : null);

/**
 * @param {import('knex').Knex} connection
 * @returns {Promise<Array<object>>} one row per cron-scheduled job (manualOnly
 *   jobs are excluded — they have no cadence to go stale against), each with
 *   `stale: boolean` plus the raw heartbeat fields.
 */
async function getSchedulerHealth(connection) {
    const cronJobs = schedule.filter((j) => !j.manualOnly);
    const runs = await JobRun.allByJobName(connection);
    const uptimeHours = process.uptime() / 3600;

    return cronJobs.map((job) => {
        const run = runs.get(job.name);
        const staleAfterHours = job.staleAfterHours || 26;
        const sinceFinished = hoursSince(run?.last_finished_at);

        // Never seen a finish yet: only treat as stale once this API process
        // has itself been up longer than the threshold — right after a fresh
        // deploy/migration the worker just hasn't had its first turn yet.
        const stale = sinceFinished == null
            ? uptimeHours > staleAfterHours
            : sinceFinished > staleAfterHours;

        return {
            name: job.name,
            description: job.description,
            cron: job.cron,
            staleAfterHours,
            lastStartedAt: run?.last_started_at || null,
            lastFinishedAt: run?.last_finished_at || null,
            lastStatus: run?.last_status || null,
            lastError: run?.last_error || null,
            hoursSinceFinished: sinceFinished == null ? null : Math.round(sinceFinished * 10) / 10,
            stale,
        };
    });
}

/**
 * Check health and, if anything is stale, email an admin — throttled so a
 * still-broken worker re-alerts at most once per REALERT_COOLDOWN_HOURS.
 * Safe to call on a timer from multiple API instances: worst case is a
 * duplicate email near the cooldown boundary, never a missed one.
 *
 * @param {import('knex').Knex} connection
 * @returns {Promise<{stale: Array<object>, alerted: boolean}>}
 */
async function checkAndAlertSchedulerHealth(connection) {
    const health = await getSchedulerHealth(connection);
    const stale = health.filter((j) => j.stale);
    if (!stale.length) return { stale, alerted: false };

    const [{ last_finished_at: lastAlertAt } = {}] = await connection('system.job_runs')
        .where({ job_name: ALERT_MARKER })
        .select('last_finished_at');
    if (lastAlertAt && hoursSince(lastAlertAt) < REALERT_COOLDOWN_HOURS) {
        return { stale, alerted: false };
    }

    const lines = stale.map((j) => {
        const since = j.lastFinishedAt
            ? `last finished ${j.hoursSinceFinished}h ago (expected within ${j.staleAfterHours}h)`
            : `has never finished a run (this app has been up ${Math.round(process.uptime() / 3600)}h)`;
        return `- ${j.name}: ${since}${j.lastStatus === 'error' ? ` — last error: ${j.lastError}` : ''}`;
    });

    try {
        await sendMail({
            to: ADMIN_INBOX,
            subject: `[HRIS] Scheduler worker looks down (${stale.length} job${stale.length > 1 ? 's' : ''} stale)`,
            text: [
                'The following scheduled jobs have not completed a run recently. The',
                'most common cause is the worker process (npm run worker / pm2 hris-worker)',
                'not actually running — check `pm2 list` on the server.',
                '',
                ...lines,
            ].join('\n'),
        });
        await JobRun.markFinished(connection, ALERT_MARKER, { status: 'ok' });
        return { stale, alerted: true };
    } catch (error) {
        console.error('[scheduler health] alert email failed:', error.message);
        return { stale, alerted: false };
    }
}

module.exports = { getSchedulerHealth, checkAndAlertSchedulerHealth };
