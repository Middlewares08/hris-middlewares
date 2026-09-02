const knex = require('../../../../database/connection');
const Setting = require('../../../../database/models/system/Setting');
const { scheduledWorkdaysByEmployee } = require('../../../../utils/workSchedule');

/**
 * 📈 HR Reports — one lightweight aggregate handler per report, powering the
 * admin "Reports" section (KPI tiles + charts + a detail grid, each with a
 * date-range filter and CSV export on the client).
 *
 * Same philosophy as DashboardController: raw grouped COUNT/SUM queries fired in
 * parallel, display-only shapes, no model layer. Reports 1–6, 8 and 10 read
 * existing tables; 7 & 9 read employee.separations; 11 & 12 have no backing data
 * yet and report `{ available: false }`.
 */

const toNum = (v) => (v == null ? 0 : Number(v));
const round2 = (v) => Math.round((toNum(v) + Number.EPSILON) * 100) / 100;

// Local-time YYYY-MM-DD (toISOString would shift the day in tz ahead of UTC).
const ymd = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const isYmd = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

/**
 * Resolve the report window from ?dateFrom / ?dateTo, falling back to a sensible
 * default per report. `defaultDays` = trailing window; pass `ytd: true` for a
 * calendar-year-to-date default.
 */
const parseRange = (req, { defaultDays = 30, ytd = false } = {}) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rawTo = req.query.dateTo;
    const rawFrom = req.query.dateFrom;

    const to = isYmd(rawTo) ? String(rawTo) : ymd(today);

    let from;
    if (isYmd(rawFrom)) {
        from = String(rawFrom);
    } else if (ytd) {
        from = `${today.getFullYear()}-01-01`;
    } else {
        const d = new Date(today);
        d.setDate(d.getDate() - (defaultDays - 1));
        from = ymd(d);
    }

    return { from, to };
};


const monthKey = (v) => String(v).slice(0, 7); // YYYY-MM

// employees -> department join chain (an employee may lack a position/department).
const withDepartment = (query, empAlias = 'e') =>
    query
        .leftJoin('employee.positions as _ep', '_ep.employee_id', `${empAlias}.id`)
        .leftJoin('lookups.positions as _p', '_p.id', '_ep.position_id')
        .leftJoin('lookups.departments as _d', '_d.id', '_p.department_id');

const fullName = (row) => `${row.first_name || ''} ${row.last_name || ''}`.trim();

const ok = (res, data) => res.status(200).json({ success: true, data });
const fail = (res, error, label) => {
    console.error(`Reports (${label}) error:`, error);
    return res.status(500).json({ success: false, message: `Server error building the ${label} report.` });
};

/* ------------------------------------------------------------------ *
 * 1. Employee Headcount
 * ------------------------------------------------------------------ */
const getHeadcount = async (req, res) => {
    try {
        const [totals, byDepartment, byPosition, byType] = await Promise.all([
            knex('employee.employees')
                .where({ is_deleted: false })
                .select(knex.raw("count(*)::int as total"))
                .select(knex.raw("count(*) filter (where is_active)::int as active"))
                .select(knex.raw("count(*) filter (where not is_active)::int as inactive"))
                .first(),

            withDepartment(knex('employee.employees as e'))
                .where('e.is_deleted', false)
                .andWhere('e.is_active', true)
                .groupBy('_d.name')
                .select(knex.raw("coalesce(_d.name, 'Unassigned') as department"))
                .countDistinct({ count: 'e.id' })
                .orderBy('count', 'desc'),

            knex('employee.employees as e')
                .leftJoin('employee.positions as ep', 'ep.employee_id', 'e.id')
                .leftJoin('lookups.positions as p', 'p.id', 'ep.position_id')
                .where('e.is_deleted', false)
                .andWhere('e.is_active', true)
                .groupBy('p.name')
                .select(knex.raw("coalesce(p.name, 'Unassigned') as position"))
                .countDistinct({ count: 'e.id' })
                .orderBy('count', 'desc'),

            knex('employee.employees')
                .where({ is_deleted: false, is_active: true })
                .groupBy('employment_type')
                .select(knex.raw("coalesce(nullif(employment_type, ''), 'Unspecified') as type"))
                .count({ count: '*' })
                .orderBy('count', 'desc'),
        ]);

        return ok(res, {
            kpis: {
                total: toNum(totals?.total),
                active: toNum(totals?.active),
                inactive: toNum(totals?.inactive),
                departments: byDepartment.length,
            },
            byDepartment: byDepartment.map((r) => ({ department: r.department, count: toNum(r.count) })),
            byPosition: byPosition.map((r) => ({ position: r.position, count: toNum(r.count) })),
            byEmploymentType: byType.map((r) => ({ type: r.type, count: toNum(r.count) })),
        });
    } catch (error) {
        return fail(res, error, 'headcount');
    }
};

/* ------------------------------------------------------------------ *
 * 2. Attendance Report
 * ------------------------------------------------------------------ */
const getAttendance = async (req, res) => {
    try {
        const { from, to } = parseRange(req, { defaultDays: 30 });

        const [statusRows, perEmployee, activeEmployees] = await Promise.all([
            knex('attendance.attendance_logs')
                .where('is_deleted', false)
                .andWhereBetween('log_date', [from, to])
                .groupBy('status')
                .select('status')
                .count({ count: '*' }),

            withDepartment(knex('attendance.attendance_logs as al').join('employee.employees as e', 'e.id', 'al.employee_id'))
                .where('al.is_deleted', false)
                .andWhereBetween('al.log_date', [from, to])
                .groupBy('e.id', 'e.first_name', 'e.last_name', 'e.employee_id', '_d.name')
                .select({ employee_id: 'e.id' }, 'e.first_name', 'e.last_name', { employee_no: 'e.employee_id' })
                .select(knex.raw("coalesce(_d.name, 'Unassigned') as department"))
                .select(knex.raw("count(*) filter (where al.status in ('present','late','half_day'))::int as present_days"))
                .select(knex.raw("count(*) filter (where al.status = 'late')::int as late_days"))
                .select(knex.raw("count(*) filter (where al.status = 'absent')::int as absent_days"))
                .select(knex.raw("count(*) filter (where al.status = 'on_leave')::int as leave_days"))
                .select(knex.raw('coalesce(sum(al.late_minutes), 0)::int as late_minutes'))
                .select(knex.raw('coalesce(sum(al.undertime_minutes), 0)::int as undertime_minutes'))
                .select(knex.raw('min(al.time_in) as first_in'))
                .select(knex.raw('max(al.time_out) as last_out'))
                .orderByRaw('late_days desc, present_days desc'),

            knex('employee.employees').where({ is_deleted: false, is_active: true }).select('id'),
        ]);

        const counts = { present: 0, late: 0, half_day: 0, absent: 0, on_leave: 0, holiday: 0 };
        statusRows.forEach((r) => { counts[r.status] = toNum(r.count); });

        // Scheduled-day denominators come from each employee's work_schedule
        // (holiday-excluded), not a flat Mon–Fri × headcount guess.
        const scheduledByEmp = await scheduledWorkdaysByEmployee(
            knex, activeEmployees.map((e) => e.id), from, to,
        );
        const scheduled = [...scheduledByEmp.values()].reduce((s, days) => s + days.length, 0);

        const attended = counts.present + counts.late + counts.half_day;
        const attendanceRate = scheduled > 0 ? round2((attended / scheduled) * 100) : 0;
        const totalLogs = Object.values(counts).reduce((s, n) => s + n, 0);
        const punctualityRate = (counts.present + counts.late) > 0
            ? round2((counts.present / (counts.present + counts.late)) * 100)
            : 0;

        return ok(res, {
            range: { from, to },
            kpis: {
                attendanceRate,
                punctualityRate,
                lateCount: counts.late,
                absentCount: counts.absent,
                scheduledDays: scheduled,
                totalLogs,
            },
            statusBreakdown: Object.entries(counts).map(([status, count]) => ({ status, count })),
            rows: perEmployee.map((r) => {
                const scheduledDays = (scheduledByEmp.get(Number(r.employee_id)) || []).length;
                const present = toNum(r.present_days);
                return {
                    employee: fullName(r),
                    employeeNo: r.employee_no || null,
                    department: r.department,
                    scheduledDays,
                    presentDays: present,
                    lateDays: toNum(r.late_days),
                    absentDays: toNum(r.absent_days),
                    leaveDays: toNum(r.leave_days),
                    lateMinutes: toNum(r.late_minutes),
                    undertimeMinutes: toNum(r.undertime_minutes),
                    attendanceRate: scheduledDays > 0 ? round2((present / scheduledDays) * 100) : null,
                    firstIn: r.first_in ? new Date(r.first_in).toISOString() : null,
                    lastOut: r.last_out ? new Date(r.last_out).toISOString() : null,
                };
            }),
        });
    } catch (error) {
        return fail(res, error, 'attendance');
    }
};

/* ------------------------------------------------------------------ *
 * 3. Absence Report
 * ------------------------------------------------------------------ */
const getAbsence = async (req, res) => {
    try {
        const { from, to } = parseRange(req, { defaultDays: 30 });

        const [perEmployee, byDepartment, byDate] = await Promise.all([
            withDepartment(knex('attendance.attendance_logs as al').join('employee.employees as e', 'e.id', 'al.employee_id'))
                .where('al.is_deleted', false)
                .andWhere('al.status', 'absent')
                .andWhereBetween('al.log_date', [from, to])
                .groupBy('e.id', 'e.first_name', 'e.last_name', 'e.employee_id', '_d.name')
                .select('e.first_name', 'e.last_name', { employee_no: 'e.employee_id' })
                .select(knex.raw("coalesce(_d.name, 'Unassigned') as department"))
                .count({ absences: '*' })
                .select(knex.raw('array_agg(al.log_date order by al.log_date) as dates'))
                .orderBy('absences', 'desc'),

            withDepartment(knex('attendance.attendance_logs as al').join('employee.employees as e', 'e.id', 'al.employee_id'))
                .where('al.is_deleted', false)
                .andWhere('al.status', 'absent')
                .andWhereBetween('al.log_date', [from, to])
                .groupBy('_d.name')
                .select(knex.raw("coalesce(_d.name, 'Unassigned') as department"))
                .count({ count: '*' })
                .orderBy('count', 'desc'),

            knex('attendance.attendance_logs')
                .where('is_deleted', false)
                .andWhere('status', 'absent')
                .andWhereBetween('log_date', [from, to])
                .groupBy('log_date')
                .select({ date: 'log_date' })
                .count({ count: '*' })
                .orderBy('date', 'asc'),
        ]);

        const totalAbsences = perEmployee.reduce((s, r) => s + toNum(r.absences), 0);

        return ok(res, {
            range: { from, to },
            kpis: {
                totalAbsences,
                employeesAffected: perEmployee.length,
                avgPerEmployee: perEmployee.length ? round2(totalAbsences / perEmployee.length) : 0,
            },
            byDepartment: byDepartment.map((r) => ({ department: r.department, count: toNum(r.count) })),
            byDate: byDate.map((r) => ({ date: String(r.date).slice(0, 10), count: toNum(r.count) })),
            rows: perEmployee.map((r) => ({
                employee: fullName(r),
                employeeNo: r.employee_no || null,
                department: r.department,
                absences: toNum(r.absences),
                dates: (r.dates || []).map((d) => String(d).slice(0, 10)),
            })),
        });
    } catch (error) {
        return fail(res, error, 'absence');
    }
};

/* ------------------------------------------------------------------ *
 * 4. Leave Utilisation
 * ------------------------------------------------------------------ */
const CREDITED_LEAVE_TYPES = ['vacation', 'sick', 'emergency'];

const getLeaveUtilisation = async (req, res) => {
    try {
        const { from, to } = parseRange(req, { ytd: true });
        const annualCredits = toNum(await Setting.get('leave.annual_credits', 15));

        const [byType, perEmployee] = await Promise.all([
            knex('attendance.leave_requests')
                .where('is_deleted', false)
                .andWhere('status', 'approved')
                .andWhere('start_date', '<=', to)
                .andWhere('end_date', '>=', from)
                .groupBy('leave_type')
                .select({ type: 'leave_type' })
                .sum({ days: 'total_days' })
                .count({ requests: '*' })
                .orderBy('days', 'desc'),

            withDepartment(knex('attendance.leave_requests as lr').join('employee.employees as e', 'e.id', 'lr.employee_id'))
                .where('lr.is_deleted', false)
                .andWhere('lr.status', 'approved')
                .andWhere('lr.start_date', '<=', to)
                .andWhere('lr.end_date', '>=', from)
                .groupBy('e.id', 'e.first_name', 'e.last_name', 'e.employee_id', '_d.name')
                .select('e.first_name', 'e.last_name', { employee_no: 'e.employee_id' })
                .select(knex.raw("coalesce(_d.name, 'Unassigned') as department"))
                .sum({ total_days: 'lr.total_days' })
                .select(knex.raw(`sum(lr.total_days) filter (where lr.leave_type in ('vacation','sick','emergency')) as credited_days`))
                .orderBy('total_days', 'desc'),
        ]);

        const creditedUsed = byType
            .filter((r) => CREDITED_LEAVE_TYPES.includes(r.type))
            .reduce((s, r) => s + toNum(r.days), 0);
        const totalUsed = byType.reduce((s, r) => s + toNum(r.days), 0);

        return ok(res, {
            range: { from, to },
            annualCredits,
            kpis: {
                totalDaysTaken: round2(totalUsed),
                creditedDaysTaken: round2(creditedUsed),
                requests: byType.reduce((s, r) => s + toNum(r.requests), 0),
                employeesOnLeave: perEmployee.length,
            },
            byType: byType.map((r) => ({
                type: r.type,
                days: round2(r.days),
                requests: toNum(r.requests),
            })),
            rows: perEmployee.map((r) => {
                const credited = round2(r.credited_days);
                return {
                    employee: fullName(r),
                    employeeNo: r.employee_no || null,
                    department: r.department,
                    daysTaken: round2(r.total_days),
                    creditedDaysTaken: credited,
                    creditsRemaining: round2(annualCredits - credited),
                    utilisationRate: annualCredits > 0 ? round2((credited / annualCredits) * 100) : 0,
                };
            }),
        });
    } catch (error) {
        return fail(res, error, 'leave utilisation');
    }
};

/* ------------------------------------------------------------------ *
 * 5. Overtime Report
 * ------------------------------------------------------------------ */
const OT_MULTIPLIER = 1.25;

const getOvertime = async (req, res) => {
    try {
        const { from, to } = parseRange(req, { defaultDays: 30 });

        const [perEmployee, byDate] = await Promise.all([
            withDepartment(knex('attendance.overtime_requests as ot').join('employee.employees as e', 'e.id', 'ot.employee_id'))
                .leftJoin('payroll.employee_compensations as ec', function join() {
                    this.on('ec.employee_id', '=', 'e.id')
                        .andOn(knex.raw('ec.is_active is true'))
                        .andOn(knex.raw('ec.is_deleted is false'));
                })
                .where('ot.is_deleted', false)
                .andWhere('ot.status', 'approved')
                .andWhereBetween('ot.work_date', [from, to])
                .groupBy('e.id', 'e.first_name', 'e.last_name', 'e.employee_id', '_d.name',
                    'ec.monthly_equivalent', 'ec.working_days_per_month', 'ec.working_hours_per_day')
                .select('e.first_name', 'e.last_name', { employee_no: 'e.employee_id' })
                .select(knex.raw("coalesce(_d.name, 'Unassigned') as department"))
                .sum({ hours: 'ot.hours' })
                .count({ filings: '*' })
                .select('ec.monthly_equivalent', 'ec.working_days_per_month', 'ec.working_hours_per_day')
                .orderBy('hours', 'desc'),

            knex('attendance.overtime_requests')
                .where('is_deleted', false)
                .andWhere('status', 'approved')
                .andWhereBetween('work_date', [from, to])
                .groupBy('work_date')
                .select({ date: 'work_date' })
                .sum({ hours: 'hours' })
                .orderBy('date', 'asc'),
        ]);

        const rows = perEmployee.map((r) => {
            const monthlyEq = toNum(r.monthly_equivalent);
            const days = toNum(r.working_days_per_month) || 22;
            const hoursPerDay = toNum(r.working_hours_per_day) || 8;
            const hourlyRate = monthlyEq > 0 ? monthlyEq / days / hoursPerDay : 0;
            const hours = round2(r.hours);
            const cost = round2(hours * hourlyRate * OT_MULTIPLIER);
            return {
                employee: fullName(r),
                employeeNo: r.employee_no || null,
                department: r.department,
                hours,
                filings: toNum(r.filings),
                hourlyRate: round2(hourlyRate),
                estimatedCost: cost,
            };
        });

        const byDepartmentMap = new Map();
        rows.forEach((r) => {
            const cur = byDepartmentMap.get(r.department) || { department: r.department, hours: 0, cost: 0 };
            cur.hours = round2(cur.hours + r.hours);
            cur.cost = round2(cur.cost + r.estimatedCost);
            byDepartmentMap.set(r.department, cur);
        });

        return ok(res, {
            range: { from, to },
            kpis: {
                totalHours: round2(rows.reduce((s, r) => s + r.hours, 0)),
                estimatedCost: round2(rows.reduce((s, r) => s + r.estimatedCost, 0)),
                employees: rows.length,
                filings: rows.reduce((s, r) => s + r.filings, 0),
            },
            byDepartment: Array.from(byDepartmentMap.values()).sort((a, b) => b.hours - a.hours),
            byDate: byDate.map((r) => ({ date: String(r.date).slice(0, 10), hours: round2(r.hours) })),
            rows,
        });
    } catch (error) {
        return fail(res, error, 'overtime');
    }
};

/* ------------------------------------------------------------------ *
 * 6. Payroll Report
 * ------------------------------------------------------------------ */
const POSTED_RUN_STATUSES = ['calculated', 'approved', 'paid'];

const getPayroll = async (req, res) => {
    try {
        const { from, to } = parseRange(req, { defaultDays: 90 });

        const runs = await knex('payroll.payroll_runs as r')
            .join('payroll.pay_periods as pp', 'pp.id', 'r.pay_period_id')
            .where('r.is_deleted', false)
            .whereIn('r.status', POSTED_RUN_STATUSES)
            .andWhereBetween('pp.pay_date', [from, to])
            .orderBy('pp.pay_date', 'asc')
            .select(
                'r.id',
                'r.uuid',
                'r.status',
                'r.run_type',
                { period: 'pp.name' },
                'pp.pay_date',
                'r.employee_count',
                'r.total_gross',
                'r.total_net',
                'r.total_taxable',
                'r.total_deductions',
                'r.total_employer_cost',
            );

        const runIds = runs.map((r) => r.id);

        let lineBreakdown = [];
        let payslipAgg = { late_minutes: 0, undertime_minutes: 0, overtime_hours: 0 };

        if (runIds.length) {
            const [lines, agg] = await Promise.all([
                knex('payroll.payslip_lines as pl')
                    .join('payroll.payslips as ps', 'ps.id', 'pl.payslip_id')
                    .whereIn('ps.payroll_run_id', runIds)
                    .andWhere('pl.is_deleted', false)
                    .andWhere('ps.is_deleted', false)
                    .groupBy('pl.line_type', 'pl.code', 'pl.label')
                    .select('pl.line_type', 'pl.code', 'pl.label')
                    .sum({ amount: 'pl.amount' })
                    .orderBy('amount', 'desc'),

                knex('payroll.payslips')
                    .whereIn('payroll_run_id', runIds)
                    .andWhere('is_deleted', false)
                    .select(knex.raw('coalesce(sum(late_minutes),0)::int as late_minutes'))
                    .select(knex.raw('coalesce(sum(undertime_minutes),0)::int as undertime_minutes'))
                    .select(knex.raw('coalesce(sum(overtime_hours),0) as overtime_hours'))
                    .first(),
            ]);
            lineBreakdown = lines;
            payslipAgg = agg;
        }

        const sum = (key) => round2(runs.reduce((s, r) => s + toNum(r[key]), 0));

        return ok(res, {
            range: { from, to },
            kpis: {
                runs: runs.length,
                totalGross: sum('total_gross'),
                totalNet: sum('total_net'),
                totalDeductions: sum('total_deductions'),
                totalEmployerCost: sum('total_employer_cost'),
                payslips: runs.reduce((s, r) => s + toNum(r.employee_count), 0),
            },
            attendanceImpact: {
                lateMinutes: toNum(payslipAgg.late_minutes),
                undertimeMinutes: toNum(payslipAgg.undertime_minutes),
                overtimeHours: round2(payslipAgg.overtime_hours),
            },
            earnings: lineBreakdown
                .filter((l) => l.line_type === 'earning')
                .map((l) => ({ code: l.code, label: l.label, amount: round2(l.amount) })),
            deductions: lineBreakdown
                .filter((l) => l.line_type === 'deduction')
                .map((l) => ({ code: l.code, label: l.label, amount: round2(l.amount) })),
            employerContributions: lineBreakdown
                .filter((l) => l.line_type === 'employer_contribution')
                .map((l) => ({ code: l.code, label: l.label, amount: round2(l.amount) })),
            rows: runs.map((r) => ({
                uuid: r.uuid,
                period: r.period,
                payDate: String(r.pay_date).slice(0, 10),
                status: r.status,
                runType: r.run_type,
                employees: toNum(r.employee_count),
                gross: round2(r.total_gross),
                net: round2(r.total_net),
                taxable: round2(r.total_taxable),
                deductions: round2(r.total_deductions),
                employerCost: round2(r.total_employer_cost),
            })),
        });
    } catch (error) {
        return fail(res, error, 'payroll');
    }
};

/* ------------------------------------------------------------------ *
 * 7. Employee Turnover
 * ------------------------------------------------------------------ */
const getTurnover = async (req, res) => {
    try {
        const { from, to } = parseRange(req, { ytd: true });

        const [separations, headcountRow, byDepartment, byMonthRows] = await Promise.all([
            knex('employee.separations')
                .where('is_deleted', false)
                .andWhereBetween('separation_date', [from, to])
                .select('separation_type', 'is_voluntary'),

            knex('employee.employees')
                .where({ is_deleted: false, is_active: true })
                .count({ count: '*' })
                .first(),

            withDepartment(knex('employee.separations as s').join('employee.employees as e', 'e.id', 's.employee_id'))
                .where('s.is_deleted', false)
                .andWhereBetween('s.separation_date', [from, to])
                .groupBy('_d.name')
                .select(knex.raw("coalesce(_d.name, 'Unassigned') as department"))
                .count({ count: '*' })
                .orderBy('count', 'desc'),

            knex('employee.separations')
                .where('is_deleted', false)
                .andWhereBetween('separation_date', [from, to])
                .groupByRaw("to_char(separation_date, 'YYYY-MM')")
                .select(knex.raw("to_char(separation_date, 'YYYY-MM') as month"))
                .count({ count: '*' })
                .orderBy('month', 'asc'),
        ]);

        const total = separations.length;
        const voluntary = separations.filter((s) => s.is_voluntary).length;
        const activeHeadcount = toNum(headcountRow?.count);
        // Approx avg headcount over the window = current active + those who left during it.
        const avgHeadcount = activeHeadcount + total / 2;
        const turnoverRate = avgHeadcount > 0 ? round2((total / avgHeadcount) * 100) : 0;

        const byTypeMap = new Map();
        separations.forEach((s) => byTypeMap.set(s.separation_type, (byTypeMap.get(s.separation_type) || 0) + 1));

        return ok(res, {
            range: { from, to },
            kpis: {
                separations: total,
                voluntary,
                involuntary: total - voluntary,
                turnoverRate,
                activeHeadcount,
            },
            byType: Array.from(byTypeMap.entries()).map(([type, count]) => ({ type, count })),
            byDepartment: byDepartment.map((r) => ({ department: r.department, count: toNum(r.count) })),
            byMonth: byMonthRows.map((r) => ({ month: r.month, count: toNum(r.count) })),
        });
    } catch (error) {
        return fail(res, error, 'turnover');
    }
};

/* ------------------------------------------------------------------ *
 * 8. New Hires Report
 * ------------------------------------------------------------------ */
const getNewHires = async (req, res) => {
    try {
        const { from, to } = parseRange(req, { defaultDays: 90 });

        const rows = await withDepartment(knex('employee.employees as e'))
            .leftJoin('lookups.positions as pos', 'pos.id', '_ep.position_id')
            .where('e.is_deleted', false)
            .whereNotNull('e.date_hired')
            .andWhereBetween('e.date_hired', [from, to])
            .select('e.first_name', 'e.last_name', { employee_no: 'e.employee_id' }, 'e.date_hired', 'e.employment_type')
            .select(knex.raw("coalesce(_d.name, 'Unassigned') as department"))
            .select(knex.raw("coalesce(pos.name, 'Unassigned') as position"))
            .orderBy('e.date_hired', 'desc');

        const groupCount = (key, fallback) => {
            const m = new Map();
            rows.forEach((r) => {
                const k = r[key] || fallback;
                m.set(k, (m.get(k) || 0) + 1);
            });
            return Array.from(m.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
        };

        const byMonthMap = new Map();
        rows.forEach((r) => {
            const k = monthKey(r.date_hired);
            byMonthMap.set(k, (byMonthMap.get(k) || 0) + 1);
        });

        return ok(res, {
            range: { from, to },
            kpis: { newHires: rows.length },
            byDepartment: groupCount('department', 'Unassigned'),
            byPosition: groupCount('position', 'Unassigned'),
            byEmploymentType: groupCount('employment_type', 'Unspecified'),
            byMonth: Array.from(byMonthMap.entries())
                .map(([month, count]) => ({ month, count }))
                .sort((a, b) => a.month.localeCompare(b.month)),
            rows: rows.map((r) => ({
                employee: fullName(r),
                employeeNo: r.employee_no || null,
                department: r.department,
                position: r.position,
                employmentType: r.employment_type || 'Unspecified',
                dateHired: String(r.date_hired).slice(0, 10),
            })),
        });
    } catch (error) {
        return fail(res, error, 'new hires');
    }
};

/* ------------------------------------------------------------------ *
 * 9. Resignation / Separation Report
 * ------------------------------------------------------------------ */
const getSeparations = async (req, res) => {
    try {
        const { from, to } = parseRange(req, { ytd: true });

        const rows = await withDepartment(knex('employee.separations as s').join('employee.employees as e', 'e.id', 's.employee_id'))
            .where('s.is_deleted', false)
            .andWhereBetween('s.separation_date', [from, to])
            .select(
                's.uuid',
                'e.first_name',
                'e.last_name',
                { employee_no: 'e.employee_id' },
                'e.date_hired',
                's.separation_date',
                's.separation_type',
                's.is_voluntary',
                's.reason',
                's.eligible_for_rehire',
            )
            .select(knex.raw("coalesce(_d.name, 'Unassigned') as department"))
            .orderBy('s.separation_date', 'desc');

        const tenureYears = (hired, left) => {
            if (!hired) return null;
            const ms = new Date(`${String(left).slice(0, 10)}T00:00:00`) - new Date(`${String(hired).slice(0, 10)}T00:00:00`);
            return round2(ms / (365.25 * 24 * 3600 * 1000));
        };

        const mapped = rows.map((r) => ({
            uuid: r.uuid,
            employee: fullName(r),
            employeeNo: r.employee_no || null,
            department: r.department,
            separationDate: String(r.separation_date).slice(0, 10),
            type: r.separation_type,
            voluntary: !!r.is_voluntary,
            reason: r.reason || null,
            eligibleForRehire: !!r.eligible_for_rehire,
            tenureYears: tenureYears(r.date_hired, r.separation_date),
        }));

        const withTenure = mapped.filter((r) => r.tenureYears != null);
        const byTypeMap = new Map();
        const byDeptMap = new Map();
        mapped.forEach((r) => {
            byTypeMap.set(r.type, (byTypeMap.get(r.type) || 0) + 1);
            byDeptMap.set(r.department, (byDeptMap.get(r.department) || 0) + 1);
        });

        return ok(res, {
            range: { from, to },
            kpis: {
                total: mapped.length,
                voluntary: mapped.filter((r) => r.voluntary).length,
                involuntary: mapped.filter((r) => !r.voluntary).length,
                avgTenureYears: withTenure.length
                    ? round2(withTenure.reduce((s, r) => s + r.tenureYears, 0) / withTenure.length)
                    : 0,
            },
            byType: Array.from(byTypeMap.entries()).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
            byDepartment: Array.from(byDeptMap.entries()).map(([department, count]) => ({ department, count })).sort((a, b) => b.count - a.count),
            rows: mapped,
        });
    } catch (error) {
        return fail(res, error, 'separations');
    }
};

/* ------------------------------------------------------------------ *
 * 10. Department Statistics
 * ------------------------------------------------------------------ */
const getDepartmentStats = async (req, res) => {
    try {
        const { from, to } = parseRange(req, { defaultDays: 30 });

        const [headcount, attendance, leave, separations, newHires] = await Promise.all([
            withDepartment(knex('employee.employees as e'))
                .where('e.is_deleted', false)
                .andWhere('e.is_active', true)
                .groupBy('_d.name')
                .select(knex.raw("coalesce(_d.name, 'Unassigned') as department"))
                .countDistinct({ headcount: 'e.id' }),

            withDepartment(knex('attendance.attendance_logs as al').join('employee.employees as e', 'e.id', 'al.employee_id'))
                .where('al.is_deleted', false)
                .andWhereBetween('al.log_date', [from, to])
                .groupBy('_d.name')
                .select(knex.raw("coalesce(_d.name, 'Unassigned') as department"))
                .select(knex.raw("count(*) filter (where al.status in ('present','late','half_day'))::int as attended"))
                .select(knex.raw('count(*)::int as logs')),

            withDepartment(knex('attendance.leave_requests as lr').join('employee.employees as e', 'e.id', 'lr.employee_id'))
                .where('lr.is_deleted', false)
                .andWhere('lr.status', 'approved')
                .andWhere('lr.start_date', '<=', to)
                .andWhere('lr.end_date', '>=', from)
                .groupBy('_d.name')
                .select(knex.raw("coalesce(_d.name, 'Unassigned') as department"))
                .sum({ leave_days: 'lr.total_days' }),

            withDepartment(knex('employee.separations as s').join('employee.employees as e', 'e.id', 's.employee_id'))
                .where('s.is_deleted', false)
                .andWhereBetween('s.separation_date', [from, to])
                .groupBy('_d.name')
                .select(knex.raw("coalesce(_d.name, 'Unassigned') as department"))
                .count({ separations: '*' }),

            withDepartment(knex('employee.employees as e'))
                .where('e.is_deleted', false)
                .whereNotNull('e.date_hired')
                .andWhereBetween('e.date_hired', [from, to])
                .groupBy('_d.name')
                .select(knex.raw("coalesce(_d.name, 'Unassigned') as department"))
                .countDistinct({ new_hires: 'e.id' }),
        ]);

        const merge = new Map();
        const bucket = (name) => {
            if (!merge.has(name)) {
                merge.set(name, {
                    department: name,
                    headcount: 0,
                    attendanceRate: 0,
                    leaveDays: 0,
                    separations: 0,
                    newHires: 0,
                    _attended: 0,
                    _logs: 0,
                });
            }
            return merge.get(name);
        };

        headcount.forEach((r) => { bucket(r.department).headcount = toNum(r.headcount); });
        attendance.forEach((r) => {
            const b = bucket(r.department);
            b._attended = toNum(r.attended);
            b._logs = toNum(r.logs);
        });
        leave.forEach((r) => { bucket(r.department).leaveDays = round2(r.leave_days); });
        separations.forEach((r) => { bucket(r.department).separations = toNum(r.separations); });
        newHires.forEach((r) => { bucket(r.department).newHires = toNum(r.new_hires); });

        const rows = Array.from(merge.values()).map((b) => {
            const attendanceRate = b._logs > 0 ? round2((b._attended / b._logs) * 100) : 0;
            const { _attended, _logs, ...rest } = b;
            return { ...rest, attendanceRate };
        }).sort((a, b) => b.headcount - a.headcount);

        return ok(res, { range: { from, to }, rows });
    } catch (error) {
        return fail(res, error, 'department statistics');
    }
};

/* ------------------------------------------------------------------ *
 * 11 & 12. Performance / Training — no backing data yet
 * ------------------------------------------------------------------ */
const getPerformance = async (_req, res) => ok(res, {
    available: false,
    message: 'Performance reporting needs the performance-evaluation module, which is not built yet.',
});
const getTraining = async (_req, res) => ok(res, {
    available: false,
    message: 'Training reporting needs the training-records module, which is not built yet.',
});

const HANDLERS = {
    headcount: getHeadcount,
    attendance: getAttendance,
    absence: getAbsence,
    leave: getLeaveUtilisation,
    overtime: getOvertime,
    payroll: getPayroll,
    turnover: getTurnover,
    'new-hires': getNewHires,
    separations: getSeparations,
    departments: getDepartmentStats,
    performance: getPerformance,
    training: getTraining,
};

const getReport = (req, res) => {
    const handler = HANDLERS[req.params.key];
    if (!handler) {
        return res.status(404).json({ success: false, message: `Unknown report "${req.params.key}".` });
    }
    return handler(req, res);
};

module.exports = { getReport, HANDLERS };
