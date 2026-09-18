// PM2 process definitions for a bare-VPS deploy.
//
// Why this file exists: the API (src/server.js) and the scheduler
// (src/worker.js) MUST run as two separate OS processes — see
// src/scheduler/README.md. Without a supervisor keeping hris-worker alive,
// the nightly cron jobs (autoClockOut, markAbsent, retention, ...) simply
// never fire, even though the job code itself is correct.
//
// Usage:
//   pm2 start ecosystem.config.js          # start both processes
//   pm2 save && pm2 startup                # persist across server reboots
//   pm2 logs hris-worker                   # tail scheduler logs
//   pm2 restart hris-api hris-worker       # after a deploy
module.exports = {
    apps: [
        {
            name: 'hris-api',
            script: 'src/server.js',
            cwd: __dirname,
            instances: 1,
            autorestart: true,
            max_restarts: 10,
            restart_delay: 5000,
            env: { NODE_ENV: 'production' },
        },
        {
            name: 'hris-worker',
            script: 'src/worker.js',
            cwd: __dirname,
            instances: 1, // exactly one — the scheduler must not run twice
            autorestart: true,
            max_restarts: 10,
            restart_delay: 5000,
            env: { NODE_ENV: 'production' },
        },
    ],
};
