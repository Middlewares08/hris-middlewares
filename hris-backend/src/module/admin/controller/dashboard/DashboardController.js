const knex = require('../../../../database/connection');
const { scheduledWorkdaysByEmployee } = require('../../../../utils/workSchedule');

/**
 * 📊 Dashboard analytics — a single aggregate payload powering the admin
 * "/dashboard" landing page (KPI tiles + Recharts graphs).
 *
 * Everything is computed with lightweight grouped COUNT/SUM queries fired in
 * parallel. No model layer is involved — the shapes here are display-only.
 */

const clampDays = (raw) => {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return 14;
    return Math.min(Math.max(n, 7), 60);
};

const toNum = (v) => (v == null ? 0 : Number(v));

// Local-time YYYY-MM-DD (toISOString would shift the day in tz ahead of UTC).
const ymd = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

/**
 * Turn the grouped [{ log_date, status, count }] rows into a zero-filled,
 * one-entry-per-day series across the requested window.
 */
const buildAttendanceTrend = (rows, days) => {
    const buckets = new Map();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = days - 1; i >= 0; i -= 1) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = ymd(d);
        buckets.set(key, { date: key, present: 0, late: 0, absent: 0, on_leave: 0 });
    }

    rows.forEach((row) => {
        const key = String(row.log_date).slice(0, 10);
        const bucket = buckets.get(key);
        if (!bucket) return;
        const count = toNum(row.count);
        if (row.status === 'present') bucket.present += count;
        else if (row.status === 'late') bucket.late += count;
        else if (row.status === 'absent') bucket.absent += count;
        else if (row.status === 'on_leave') bucket.on_leave += count;
        else if (row.status === 'half_day') bucket.present += count;
    });

    return Array.from(buckets.values());
};

const getAnalytics = async (req, res) => {
    try {
        const days = clampDays(req.query.days);

        const [
            headcountRow,
            newHiresRow,
            attendanceTodayRows,
            onLeaveRow,
            pendingLeaveRow,
            pendingOvertimeRow,
            headcountByDepartment,
            attendanceTrendRows,
            leaveByTypeRows,
            payrollRuns,
            inactiveHeadcountRow,
            separations30dRow,
            overtimeHours30dRow,
            headcountByType,
        ] = await Promise.all([
            // Active headcount
            knex('employee.employees')
                .where({ is_active: true, is_deleted: false })
                .count({ count: '*' })
                .first(),

            // New hires — last 30 days
            knex('employee.employees')
                .where({ is_deleted: false })
                .andWhereRaw("created_at >= now() - interval '30 days'")
                .count({ count: '*' })
                .first(),

            // Today's attendance by status
            knex('attendance.attendance_logs')
                .where({ is_deleted: false })
                .andWhereRaw('log_date = current_date')
                .select('status')
                .count({ count: '*' })
                .groupBy('status'),

            // On approved leave right now
            knex('attendance.leave_requests')
                .where({ is_deleted: false, status: 'approved' })
                .andWhereRaw('current_date between start_date and end_date')
                .countDistinct({ count: 'employee_id' })
                .first(),

            // Pending leave requests
            knex('attendance.leave_requests')
                .where({ is_deleted: false, status: 'pending' })
                .count({ count: '*' })
                .first(),

            // Pending overtime requests
            knex('attendance.overtime_requests')
                .where({ is_deleted: false, status: 'pending' })
                .count({ count: '*' })
                .first(),

            // Headcount by department (via the employee↔position pivot)
            knex('employee.positions as ep')
                .join('lookups.positions as p', 'p.id', 'ep.position_id')
                .join('lookups.departments as d', 'd.id', 'p.department_id')
                .join('employee.employees as e', 'e.id', 'ep.employee_id')
                .where('d.is_deleted', false)
                .andWhere('e.is_deleted', false)
                .andWhere('e.is_active', true)
                .groupBy('d.name')
                .orderBy('count', 'desc')
                .select('d.name as department')
                .countDistinct({ count: 'ep.employee_id' }),

            // Attendance trend — grouped by day + status across the window
            knex('attendance.attendance_logs')
                .where({ is_deleted: false })
                .andWhereRaw("log_date >= current_date - ?::int", [days - 1])
                .select('log_date', 'status')
                .count({ count: '*' })
                .groupBy('log_date', 'status'),

            // Leave mix — last 90 days by start_date
            knex('attendance.leave_requests')
                .where({ is_deleted: false })
                .andWhereRaw("start_date >= now() - interval '90 days'")
                .select({ type: 'leave_type' })
                .count({ count: '*' })
                .groupBy('leave_type')
                .orderBy('count', 'desc'),

            // Payroll cost trend — last 6 posted runs
            knex('payroll.payroll_runs as r')
                .join('payroll.pay_periods as pp', 'pp.id', 'r.pay_period_id')
                .where('r.is_deleted', false)
                .whereIn('r.status', ['calculated', 'approved', 'paid'])
                .orderBy('pp.pay_date', 'desc')
                .limit(6)
                .select(
                    'pp.name as period',
                    'pp.pay_date',
                    'r.total_gross',
                    'r.total_net',
                    'r.total_employer_cost',
                    'r.employee_count',
                ),

            // Inactive headcount
            knex('employee.employees')
                .where({ is_active: false, is_deleted: false })
                .count({ count: '*' })
                .first(),

            // Separations — last 30 days
            knex('employee.separations')
                .where({ is_deleted: false })
                .andWhereRaw("separation_date >= current_date - interval '30 days'")
                .count({ count: '*' })
                .first(),

            // Approved overtime hours — last 30 days
            knex('attendance.overtime_requests')
                .where({ is_deleted: false, status: 'approved' })
                .andWhereRaw("work_date >= current_date - interval '30 days'")
                .sum({ hours: 'hours' })
                .first(),

            // Active headcount by employment type
            knex('employee.employees')
                .where({ is_deleted: false, is_active: true })
                .groupBy('employment_type')
                .select(knex.raw("coalesce(nullif(employment_type, ''), 'Unspecified') as type"))
                .count({ count: '*' })
                .orderBy('count', 'desc'),
        ]);

        const activeHeadcount = toNum(headcountRow?.count);

        const attendedToday = attendanceTodayRows
            .filter((r) => ['present', 'late', 'half_day'].includes(r.status))
            .reduce((sum, r) => sum + toNum(r.count), 0);

        // Denominator = employees actually scheduled to work today (per their
        // work_schedule, holidays excluded), not the whole active headcount.
        const today = ymd(new Date());
        const activeIds = (await knex('employee.employees')
            .where({ is_active: true, is_deleted: false }).select('id')).map((e) => e.id);
        const scheduledTodayMap = await scheduledWorkdaysByEmployee(knex, activeIds, today, today);
        const scheduledToday = [...scheduledTodayMap.values()].filter((d) => d.length > 0).length;

        const attendanceRateToday = scheduledToday > 0
            ? Math.round((attendedToday / scheduledToday) * 100)
            : 0;

        const data = {
            generatedAt: new Date().toISOString(),
            windowDays: days,
            kpis: {
                activeHeadcount,
                newHires30d: toNum(newHiresRow?.count),
                attendanceRateToday,
                attendedToday,
                scheduledToday,
                onLeaveToday: toNum(onLeaveRow?.count),
                pendingLeave: toNum(pendingLeaveRow?.count),
                pendingOvertime: toNum(pendingOvertimeRow?.count),
                inactiveHeadcount: toNum(inactiveHeadcountRow?.count),
                separations30d: toNum(separations30dRow?.count),
                overtimeHours30d: Math.round(toNum(overtimeHours30dRow?.hours) * 100) / 100,
            },
            headcountByType: headcountByType.map((r) => ({
                type: r.type,
                count: toNum(r.count),
            })),
            headcountByDepartment: headcountByDepartment.map((r) => ({
                department: r.department,
                count: toNum(r.count),
            })),
            attendanceTrend: buildAttendanceTrend(attendanceTrendRows, days),
            leaveByType: leaveByTypeRows.map((r) => ({
                type: r.type,
                count: toNum(r.count),
            })),
            payrollCostTrend: payrollRuns
                .slice()
                .reverse()
                .map((r) => ({
                    period: r.period,
                    payDate: String(r.pay_date).slice(0, 10),
                    gross: toNum(r.total_gross),
                    net: toNum(r.total_net),
                    employerCost: toNum(r.total_employer_cost),
                    employees: toNum(r.employee_count),
                })),
        };

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Dashboard analytics error:', error);
        return res.status(500).json({ success: false, message: 'Server error building dashboard analytics.' });
    }
};

module.exports = { getAnalytics };
