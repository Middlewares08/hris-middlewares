// src/worker.js — the scheduler process. Runs alongside the API (src/server.js),
// as its own deployable so scheduled work never competes with request handling
// and the schedule fires exactly once regardless of how many API instances run.
require('dotenv').config();

const connection = require('./database/connection');
const { start, schedule, runJob } = require('./scheduler');

async function main() {
    // One-shot mode for manual runs / backfills:
    //   node src/worker.js --once autoClockOut
    const onceIdx = process.argv.indexOf('--once');
    if (onceIdx !== -1) {
        const name = process.argv[onceIdx + 1];
        const job = schedule.find((j) => j.name === name);
        if (!job) {
            console.error(`Unknown job "${name}". Known jobs: ${schedule.map((j) => j.name).join(', ')}`);
            await connection.destroy();
            process.exit(1);
        }
        await runJob(job.name, job.handler);
        await connection.destroy();
        process.exit(0);
    }

    start();
}

const shutdown = async (signal) => {
    console.log(`[worker] ${signal} received — shutting down`);
    try {
        await connection.destroy();
    } catch {
        /* ignore */
    }
    process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((error) => {
    console.error('[worker] fatal:', error);
    process.exit(1);
});
