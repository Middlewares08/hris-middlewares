const ActivityLog = require('../database/models/employee/ActivityLog');

const VALID_CATEGORIES = ['attendance', 'leave', 'payroll', 'profile', 'document', 'system'];

/**
 * 📝 Records an entry in employee.activity_logs.
 *
 * Fire-and-forget by design — a failure here must never break the operation
 * that triggered it, so all errors are swallowed (and logged to the console).
 *
 * @param {object}  params
 * @param {number}  params.employeeId  - timeline owner (employee.employees.id)
 * @param {string}  params.action      - machine key, e.g. 'attendance.clock_in'
 * @param {string}  params.description - human-readable feed line
 * @param {string} [params.category]   - one of VALID_CATEGORIES (default 'system')
 * @param {object} [params.metadata]   - free-form context payload
 * @param {import('express').Request} [params.req] - request, for ip / user agent / actor
 * @param {import('objection').Transaction} [trx]  - optional transaction to run inside
 */
async function logActivity({ employeeId, action, description, category, metadata, req }, trx) {
    try {
        if (!employeeId || !action || !description) return;

        await ActivityLog.query(trx).insert({
            employee_id: employeeId,
            action,
            category: VALID_CATEGORIES.includes(category) ? category : 'system',
            description,
            metadata: metadata || null,
            ip_address: req?.ip || req?.headers?.['x-forwarded-for'] || null,
            user_agent: (req?.headers?.['user-agent'] || '').substring(0, 255) || null,
            created_by: req?.user?.id ? parseInt(req.user.id, 10) : null,
        });
    } catch (error) {
        console.error('activityLogger.logActivity failed:', error.message);
    }
}

module.exports = { logActivity };
