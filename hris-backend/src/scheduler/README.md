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

## Configuration

See `.env.example` (`SCHEDULER_*`, `AUTO_CLOCK_OUT_*`). `SCHEDULER_ENABLED=false`
turns every job off on that instance.

## Adding a job

1. Create `src/scheduler/jobs/myJob.js` exporting `async (trx) => { ... }`.
   Do all DB work through the passed `trx`; return a small summary object for the logs.
2. Add a row to the `schedule` array in `src/scheduler/index.js`
   (`name`, `cron`, `handler`).

## Current jobs

| Job            | Default schedule | Purpose |
| -------------- | ---------------- | ------- |
| `autoClockOut` | `0 2 * * *`      | Stamps `time_out` on attendance rows where the employee clocked in but never out, capped at `STANDARD_WORKDAY_HOURS`, flagged `is_auto_closed` for manager review. Skips punches younger than `AUTO_CLOCK_OUT_MIN_OPEN_HOURS` (night-shift safety). |

## When to outgrow this

Move to a Postgres-backed queue (`pg-boss`) or Redis (`BullMQ`) once you need
per-job retries, dead-letter handling, backfill history, or a dashboard. The job
functions stay the same — only the runner changes.
