const connection = require('../../../../database/connection');
const { getSchedulerHealth } = require('../../../../scheduler/health');

/**
 * 🔍 READ — per-job scheduler heartbeat (admin). Answers "is the worker
 * process actually running" without needing server SSH access.
 */
const getHealth = async (req, res) => {
    try {
        const jobs = await getSchedulerHealth(connection);
        return res.status(200).json({
            success: true,
            data: { jobs, healthy: jobs.every((j) => !j.stale) },
        });
    } catch (error) {
        console.error('Fetch scheduler health error:', error);
        return res.status(500).json({ success: false, message: 'Server error retrieving scheduler health.' });
    }
};

module.exports = { getHealth };
