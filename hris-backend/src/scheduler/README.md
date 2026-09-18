# Scheduler

Recurring background jobs for the HRIS backend.

## How it's wired

- **Same repo, separate process.** `src/worker.js` is its own entrypoint next to
  `src/server.js`. The jobs reuse the same Objection models, Knex connection and
  utilities (`logActivity`, the payroll engine, …) — a separate repo would force a
  shared package or copy-paste.
- **Run it as its own service** (Render "Background Worker", Railway service, a
  second PM2 process, a `command:`-overridden container). Do **not** register cron
  inside `server.js`: with more than one API instance the schedule would fire once
  per instance.
- **`node-cron`** drives the schedule. Every job runs through `runJob()`, which
  wraps it in a transaction guarded by a **PostgreSQL advisory lock** — so a job
  never overlaps itself even if the worker is accidentally run twice. It also logs
  start / duration / outcome and swallows errors so one bad job can't crash the
  worker.

## Commands

```bash
npm run worker         # start the scheduler process
npm run worker:dev     # same, with nodemon
npm run job autoClockOut   # run one job now (manual / backfill), then exit
```

## Deploying on a bare VPS (pm2)

`ecosystem.config.js` at the repo root declares **two** pm2 processes —
`hris-api` (`src/server.js`) and `hris-worker` (`src/worker.js`). Both must run;
if only `hris-api` is started, the API works fine but every cron job (including
`autoClockOut`) silently never fires — there's no error, the rows just pile up.

```bash
npm i -g pm2                       # once per server
pm2 start ecosystem.config.js      # starts hris-api + hris-worker
pm2 save && pm2 startup            # survive a server reboot
pm2 logs hris-worker               # confirm "[scheduler] registered ..." lines
```

After a deploy: `pm2 restart hris-api hris-worker` (or `pm2 reload` for
zero-downtime on the API). Keep `hris-worker` at `instances: 1` — the advisory
lock in `runJob` stops a job overlapping itself, but there's no reason to run a
second worker process.

## Configuration

See `.env.example` (`SCHEDULER_*`, `AUTO_CLOCK_OUT_*`). `SCHEDULER_ENABLED=false`
turns every job off on that instance.

`autoClockOut` also has a DB-backed on/off switch — the `attendance.auto_clock_out_enabled`
key in `system.settings` (default `true`), editable from the admin Attendance Logs page
or `PUT /system/settings/attendance.auto_clock_out_enabled`. Unlike `SCHEDULER_ENABLED`,
this only disables that one job (still runs on cron, just returns `{skipped:true}`) and
doesn't require a redeploy to flip.

## Adding a job

1. Create `src/scheduler/jobs/myJob.js` exporting `async (trx) => { ... }`.
   Do all DB work through the passed `trx`; return a small summary object for the logs.
2. Add a row to the `schedule` array in `src/scheduler/index.js`
   (`name`, `cron`, `handler`).

## Current jobs

| Job                 | Default schedule | Purpose |
| ------------------- | ---------------- | ------- |
| `autoClockOut`      | `0 2 * * *`      | Stamps `time_out` on attendance rows where the employee clocked in but never out, capped at `STANDARD_WORKDAY_HOURS`, flagged `is_auto_closed` for manager review. Skips punches younger than `AUTO_CLOCK_OUT_MIN_OPEN_HOURS` (night-shift safety). Also refreshes the schedule columns. |
| `markAbsent`        | `30 2 * * *`     | For each active employee × scheduled workday in the trailing `ABSENT_BACKFILL_DAYS` window with no attendance log: inserts `absent` (or `on_leave` if an approved leave covers it), stamped against the employee's `work_schedule`, skipping rest days / non-working holidays / pre-hire dates. Idempotent. |
| `backfillSchedule`  | manual only      | `npm run job backfillSchedule` — stamps `schedule_id` / `scheduled_*` / `late_minutes` / `undertime_minutes` / `is_rest_day` / `is_holiday` on attendance rows written before the work-schedule module. Processes up to `BACKFILL_SCHEDULE_LIMIT` rows/run; re-run until `remaining` is 0. |

## If the worker process dies

Nothing user-facing breaks when `hris-worker` goes down — no request fails, no
error surfaces — so it can sit dead for days before anyone notices rows piling
up. Two layers catch this:

1. **Heartbeat.** `runJob()` writes to `system.job_runs` (one row per job:
   `last_started_at`, `last_finished_at`, `last_status`, `last_error`) on a
   plain `connection` query, *not* the job's own `trx` — so the row is accurate
   even when the job errors and rolls back, or the process is killed mid-run.
2. **Dead-man's-switch.** `src/scheduler/health.js`, run on a timer from
   **`server.js`** (not the worker — a dead worker can't report its own death).
   Every `SCHEDULER_HEALTH_CHECK_INTERVAL_MINUTES` (default 60) it compares each
   cron job's `staleAfterHours` (set per job in the `schedule` array, default 26h;
   the weekly reconcile job gets 8 days) against its last-finished heartbeat, and
   emails `ADMIN_CONTACT_EMAIL` if anything's gone quiet. Re-alerts are throttled
   to once per `SCHEDULER_HEALTH_REALERT_HOURS` (default 12) so a still-broken
   worker doesn't spam the inbox. `SCHEDULER_HEALTH_CHECK_ENABLED=false` disables it.

Check it yourself anytime: `GET /system/scheduler/health` (`maintenance:view`),
or `SELECT * FROM system.job_runs;`.

## When to outgrow this

Move to a Postgres-backed queue (`pg-boss`) or Redis (`BullMQ`) once you need
per-job retries, dead-letter handling, backfill history, or a dashboard. The job
functions stay the same — only the runner changes.
