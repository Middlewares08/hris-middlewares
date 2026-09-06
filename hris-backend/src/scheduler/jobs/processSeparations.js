const Setting = require('../../database/models/system/Setting');
const { logActivity } = require('../../utils/activityLogger');

/**
 * Flips an employee inactive once their separation's work cutoff
 * (last_working_day, falling back to separation_date when unset) has arrived.
 *
 * Only relevant when `separation.defer_inactivation` is on — createSeparation
 * already deactivates immediately for a cutoff that's today/past, and does the
 * deactivation itself (nothing left to defer) whenever the setting is off. This
 * job re-reads the live separations table each run, so editing last_working_day
 * after the record was created is picked up on the next run with no special
 * handling needed.
 *
 * @param {import('knex').Knex.Transaction} trx
 */
async function processSeparations(trx) {
    const deferEnabled = await Setting.getBool('separation.defer_inactivation', true, trx);
    if (!deferEnabled) return { skipped: true, reason: 'separation.defer_inactivation is off' };

    const today = new Date().toISOString().slice(0, 10);

    const due = await trx('employee.separations as s')
        .join('employee.employees as e', 'e.id', 's.employee_id')
        .where('s.is_deleted', false)
        .andWhere('e.is_active', true)
        .andWhereRaw('COALESCE(s.last_working_day, s.separation_date) <= ?', [today])
        .select('s.id', 's.employee_id', 's.separation_type');

    for (const row of due) {
        // eslint-disable-next-line no-await-in-loop
        await trx('employee.employees')
            .where({ id: row.employee_id })
            .update({ is_active: false, updated_at: trx.fn.now() });

        // eslint-disable-next-line no-await-in-loop
        await logActivity(
            {
                employeeId: row.employee_id,
                action: 'employee.separated',
                category: 'system',
                description: `Employee set to inactive — separation work cutoff reached (${row.separation_type}).`,
                metadata: { separation_id: row.id },
            },
            trx,
        );
    }

    return { candidates: due.length, inactivated: due.length };
}

module.exports = processSeparations;
