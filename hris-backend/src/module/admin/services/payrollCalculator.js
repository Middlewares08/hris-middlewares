// src/module/admin/services/payrollCalculator.js
//
// Payroll calculation engine.
//
// Design goals:
//   - Deterministic & idempotent: calculating a run twice yields the same payslips
//     (old payslips + lines are wiped and rebuilt inside one transaction).
//   - Never half-writes: everything runs inside a single Model.transaction.
//   - Never aborts the whole run for one bad employee: per-employee failures are
//     caught and returned in `skipped[]` with a reason.
//   - No statutory constants in code: SSS / PhilHealth / Pag-IBIG / tax figures are
//     resolved from payroll.statutory_tables (effective-dated, JSONB brackets/config).
//
// The JSONB contract for payroll.statutory_tables is documented inline next to each
// compute* helper below.

const { Model } = require('objection');
require('../../../database/connection'); // bind Objection to Knex

const PayrollRun = require('../../../database/models/payroll/PayrollRun');
const Payslip = require('../../../database/models/payroll/Payslip');
const PayslipLine = require('../../../database/models/payroll/PayslipLine');
const PayslipAdjustment = require('../../../database/models/payroll/PayslipAdjustment');
const PayComponent = require('../../../database/models/payroll/PayComponent');
const EmployeeCompensation = require('../../../database/models/payroll/EmployeeCompensation');
const EmployeeComponentAssignment = require('../../../database/models/payroll/EmployeeComponentAssignment');
const StatutoryTable = require('../../../database/models/payroll/StatutoryTable');
const Employee = require('../../../database/models/employee/Employee');
const OvertimeRequest = require('../../../database/models/attendance/OvertimeRequest');
const LeaveRequest = require('../../../database/models/attendance/LeaveRequest');
const Setting = require('../../../database/models/system/Setting');
const { scheduledWorkdaysByEmployee } = require('../../../utils/workSchedule');

const LATE_CUTOFF = '09:15'; // fallback only — used for attendance rows written before the schedule module
const THIRTEENTH_MONTH_TAX_EXEMPT_CEILING = 90000; // NIRC sec. 32(B)(7)(e)

const PERIODS_PER_MONTH = {
    monthly: 1,
    semi_monthly: 2,
    weekly: 4.333333,
    bi_weekly: 2.166667,
};

/* ============================================================
 * Public API
 * ========================================================== */

/**
 * Calculate (or recalculate) every payslip for a run.
 *
 * @param {string|number} runRef            run uuid or id
 * @param {object}        opts
 * @param {number[]}     [opts.employeeIds] restrict to these employees; default = all active
 * @param {number|null}  [opts.actorId]     employee id performing the action (audit trail)
 * @returns {Promise<{ run_id, run_uuid, processed_count, skipped, totals }>}
 */
async function calculateRun(runRef, { employeeIds = null, actorId = null } = {}) {
    const run = await PayrollRun.query()
        .modify('notDeleted')
        .findOne(resolveRef(runRef))
        .withGraphFetched('period');

    if (!run) throw httpError(404, 'Payroll run not found.');
    if (!run.period || run.period.is_deleted) throw httpError(422, 'Payroll run is not linked to a valid pay period.');
    if (!['draft', 'calculating', 'calculated'].includes(run.status)) {
        throw httpError(409, `A ${run.status} payroll run can no longer be calculated.`);
    }
    if (run.period.status === 'closed') throw httpError(409, 'The pay period is closed.');

    const period = run.period;
    const periodStart = String(period.period_start).substring(0, 10);
    const periodEnd = String(period.period_end).substring(0, 10);
    const perMonth = PERIODS_PER_MONTH[period.frequency] || 1;

    if (!periodStart || !periodEnd || periodEnd < periodStart) {
        throw httpError(422, 'Pay period has an invalid date range.');
    }

    // Preload the effective statutory schedules once for the whole run.
    const [sss, phic, hdmf, wtax] = await Promise.all([
        StatutoryTable.resolve('sss', periodEnd),
        StatutoryTable.resolve('philhealth', periodEnd),
        StatutoryTable.resolve('pagibig', periodEnd),
        StatutoryTable.resolve('withholding_tax', periodEnd),
    ]);
    const statutory = { sss, phic, hdmf, wtax };

    // Feature flag — when Overtime is off, approved OT filings are ignored by payroll.
    const otEnabled = await Setting.getBool('overtime.enabled', true);

    const componentRows = await PayComponent.query().where('is_deleted', false);
    const componentByCode = new Map(componentRows.map((c) => [c.code, c]));

    // Resolve the target employee set.
    let targetIds;
    if (Array.isArray(employeeIds) && employeeIds.length) {
        targetIds = [...new Set(employeeIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
        if (!targetIds.length) throw httpError(400, 'employeeIds contained no valid employee ids.');
    } else {
        const actives = await Employee.query()
            .where('employee.employees.is_deleted', false)
            .where('employee.employees.is_active', true)
            .select('id');
        targetIds = actives.map((e) => e.id);
    }

    if (!targetIds.length) throw httpError(422, 'No employees to process for this run.');

    const processed = [];
    const skipped = [];

    await Model.transaction(async (trx) => {
        await PayrollRun.query(trx).findById(run.id).patch({ status: 'calculating', updated_by: actorId });

        for (const employeeId of targetIds) {
            try {
                const result = await buildEmployeePayslip({
                    trx, run, period, periodStart, periodEnd, perMonth,
                    employeeId, componentByCode, statutory, otEnabled, actorId,
                });
                if (result.skipped) skipped.push({ employee_id: employeeId, reason: result.reason });
                else processed.push(result.summary);
            } catch (err) {
                skipped.push({ employee_id: employeeId, reason: err.message || 'Unknown calculation error.' });
            }
        }

        const totals = processed.reduce((acc, p) => ({
            total_gross: acc.total_gross + p.gross_pay,
            total_taxable: acc.total_taxable + p.taxable_income,
            total_deductions: acc.total_deductions + p.total_deductions,
            total_net: acc.total_net + p.net_pay,
            total_employer_cost: acc.total_employer_cost + p.total_employer_contributions,
        }), { total_gross: 0, total_taxable: 0, total_deductions: 0, total_net: 0, total_employer_cost: 0 });

        await PayrollRun.query(trx).findById(run.id).patch({
            status: 'calculated',
            employee_count: processed.length,
            total_gross: money(totals.total_gross),
            total_taxable: money(totals.total_taxable),
            total_deductions: money(totals.total_deductions),
            total_net: money(totals.total_net),
            total_employer_cost: money(totals.total_employer_cost),
            calculated_at: new Date().toISOString(),
            updated_by: actorId,
        });
    });

    const finalRun = await PayrollRun.query().findById(run.id);

    return {
        run_id: run.id,
        run_uuid: run.uuid,
        processed_count: processed.length,
        skipped,
        totals: {
            employee_count: finalRun.employee_count,
            total_gross: Number(finalRun.total_gross),
            total_taxable: Number(finalRun.total_taxable),
            total_deductions: Number(finalRun.total_deductions),
            total_net: Number(finalRun.total_net),
            total_employer_cost: Number(finalRun.total_employer_cost),
        },
    };
}

/* ============================================================
 * Per-employee builder
 * ========================================================== */

async function buildEmployeePayslip(ctx) {
    const { trx, run, periodStart, periodEnd, perMonth, employeeId, componentByCode, statutory, otEnabled, actorId } = ctx;

    const employee = await Employee.query(trx)
        .findById(employeeId)
        .where('employee.employees.is_deleted', false);
    if (!employee) return { skipped: true, reason: 'Employee not found or archived.' };

    const comp = await EmployeeCompensation.activeForEmployee(employeeId, periodEnd, trx);
    if (!comp) return { skipped: true, reason: 'No active compensation record effective for this period.' };

    // --- Idempotency: wipe any prior payslip for this (run, employee) and rebuild ---
    const existing = await Payslip.query(trx).where({ payroll_run_id: run.id, employee_id: employeeId });
    if (existing.length) {
        const ids = existing.map((p) => p.id);
        await PayslipLine.query(trx).delete().whereIn('payslip_id', ids);
        await Payslip.query(trx).delete().whereIn('id', ids);
        await PayslipAdjustment.query(trx)
            .patch({ status: 'pending', applied_payslip_id: null, updated_by: actorId })
            .where({ payroll_run_id: run.id, employee_id: employeeId, status: 'applied' });
    }

    const monthlyEq = toNum(comp.monthly_equivalent) || EmployeeCompensation.deriveMonthlyEquivalent(comp);
    const workingDays = toNum(comp.working_days_per_month) || 22;
    const workingHours = toNum(comp.working_hours_per_day) || 8;
    const dailyRate = safeDiv(monthlyEq, workingDays);
    const hourlyRate = safeDiv(dailyRate, workingHours);
    const salaried = comp.rate_type === 'monthly' || comp.rate_type === 'semi_monthly';

    /** @type {Array<object>} */
    const lines = [];
    const pushLine = (partial) => lines.push(normalizeLine(partial, componentByCode));

    let att = {
        worked_days: 0, worked_hours: 0, absent_days: 0,
        late_minutes: 0, undertime_minutes: 0, overtime_hours: 0,
    };
    let basicAmount = 0;

    if (run.run_type === 'thirteenth_month') {
        // Simplified: one month-equivalent of basic. Non-taxable up to the statutory
        // ceiling, excess taxable. Prorate by months-worked outside the engine if needed.
        const gross13 = money(monthlyEq);
        const nonTax = money(Math.min(gross13, THIRTEENTH_MONTH_TAX_EXEMPT_CEILING));
        const taxablePart = money(Math.max(0, gross13 - nonTax));
        if (nonTax > 0) {
            pushLine({ code: 'THIRTEENTH_MONTH', label: '13th Month Pay', line_type: 'earning', source: 'formula', quantity: 1, rate: nonTax, amount: nonTax, is_taxable: false });
        }
        if (taxablePart > 0) {
            pushLine({ code: 'ALLOW_TAXABLE', label: '13th Month Pay (taxable excess)', line_type: 'earning', source: 'formula', quantity: 1, rate: taxablePart, amount: taxablePart, is_taxable: true });
        }
        basicAmount = gross13;
    } else {
        // --- Attendance aggregates for the covered period ---
        att = await aggregateAttendance(trx, employeeId, periodStart, periodEnd, otEnabled);

        // --- Basic pay ---
        const basic = computeBasicPay({ comp, monthlyEq, perMonth, att, dailyRate, hourlyRate });
        basicAmount = basic.amount;
        pushLine({ code: 'BASIC', label: 'Basic Pay', line_type: 'earning', source: 'basic', quantity: basic.quantity, rate: basic.rate, amount: basic.amount, is_taxable: true });

        // --- Attendance-driven adjustments ---
        if (salaried && att.absent_days > 0) {
            pushLine({ code: 'ABSENCE', label: 'Absences', line_type: 'deduction', source: 'attendance', quantity: att.absent_days, rate: money(dailyRate), amount: money(att.absent_days * dailyRate) });
        }
        if (salaried) {
            const lateHrs = (att.late_minutes + att.undertime_minutes) / 60;
            if (lateHrs > 0) {
                pushLine({ code: 'TARDINESS', label: 'Tardiness / Undertime', line_type: 'deduction', source: 'attendance', quantity: round2(lateHrs), rate: money(hourlyRate), amount: money(lateHrs * hourlyRate) });
            }
        }
        if (att.overtime_hours > 0) {
            const otComp = componentByCode.get('OT_REG');
            const otMultiplier = otComp && toNum(otComp.default_rate) ? toNum(otComp.default_rate) : 1.25;
            const otRate = money(hourlyRate * otMultiplier);
            pushLine({ code: 'OT_REG', label: 'Overtime Pay', line_type: 'earning', source: 'attendance', quantity: att.overtime_hours, rate: otRate, amount: money(att.overtime_hours * otRate), is_taxable: true });
        }

        // --- Recurring component assignments (allowances / deductions / loans) ---
        const assignments = await EmployeeComponentAssignment.activeForEmployee(employeeId, periodStart, periodEnd, trx);
        for (const a of assignments) {
            const c = a.component;
            if (!c || c.is_deleted) continue;

            const isLoan = a.outstanding_balance !== null && a.outstanding_balance !== undefined;
            let amount;

            if (isLoan) {
                // Balances are NOT mutated here — amortization happens once, on run approval
                // (see PayrollRunController.approve). Calculating a run is side-effect free.
                const bal = toNum(a.outstanding_balance);
                if (bal <= 0) continue;
                const inst = toNum(a.installment_amount) || bal;
                amount = money(Math.min(inst, bal));
                if (amount <= 0) continue;
            } else if (a.amount !== null && a.amount !== undefined) {
                amount = money(toNum(a.amount));
            } else if (a.rate !== null && a.rate !== undefined) {
                const base = c.calculation_type === 'percentage_of_basic' ? basicAmount : safeDiv(monthlyEq, perMonth);
                amount = money(toNum(a.rate) * base);
            } else {
                amount = money(toNum(c.default_amount));
            }
            if (!amount) continue;

            pushLine({
                component_id: c.id, assignment_id: a.id, code: c.code, label: c.name,
                line_type: c.component_type === 'earning' ? 'earning' : 'deduction',
                source: 'recurring', quantity: 1, rate: amount, amount,
                is_taxable: !!c.is_taxable,
                metadata: a.reference_no ? { reference_no: a.reference_no } : null,
            });
        }

        // --- One-off adjustments queued for this run ---
        const adjustments = await PayslipAdjustment.query(trx)
            .where({ payroll_run_id: run.id, employee_id: employeeId, is_deleted: false, status: 'pending' });
        for (const adj of adjustments) {
            const amt = money(toNum(adj.amount));
            if (!amt) continue;
            pushLine({
                component_id: adj.component_id || null, code: null, label: adj.label,
                line_type: adj.adjustment_type, source: 'adjustment',
                quantity: 1, rate: amt, amount: amt, is_taxable: !!adj.is_taxable,
                _adjustmentId: adj.id,
            });
        }
    }

    // --- Interim earning totals (statutory basis) ---
    const earningLines = lines.filter((l) => l.line_type === 'earning');
    const taxableEarnings = money(sum(earningLines.filter((l) => l.is_taxable).map((l) => l.amount)));
    const preTaxDeductions = money(sum(
        lines.filter((l) => l.line_type === 'deduction' && l.source === 'attendance').map((l) => l.amount),
    ));

    // --- Statutory contributions (skipped entirely for 13th-month runs) ---
    const contribFactor = 1 / perMonth;
    const stat = (run.run_type === 'thirteenth_month')
        ? { employeeLines: [], employerLines: [] }
        : computeStatutory({ monthlyEq, statutory, contribFactor });

    for (const s of stat.employeeLines) pushLine({ ...s, line_type: 'deduction', source: 'statutory', is_statutory: true });
    for (const s of stat.employerLines) pushLine({ ...s, line_type: 'employer_contribution', source: 'statutory', is_statutory: true });

    // --- Withholding tax ---
    const statutoryEE = money(sum(stat.employeeLines.map((s) => s.amount)));
    let taxableIncome = money(taxableEarnings - preTaxDeductions - statutoryEE);
    if (taxableIncome < 0) taxableIncome = 0;

    let wtaxAmount = 0;
    if (run.run_type !== 'thirteenth_month' && !comp.is_tax_exempt && !comp.is_minimum_wage_earner) {
        wtaxAmount = computeWithholdingTax(taxableIncome, perMonth, statutory.wtax);
    }
    if (wtaxAmount > 0) {
        pushLine({ code: 'WTAX', label: 'Withholding Tax', line_type: 'deduction', source: 'statutory', is_statutory: true, quantity: 1, rate: wtaxAmount, amount: wtaxAmount });
    }

    // --- Final roll-up ---
    const finalEarnings = lines.filter((l) => l.line_type === 'earning');
    const finalDeductions = lines.filter((l) => l.line_type === 'deduction');
    const finalEmployer = lines.filter((l) => l.line_type === 'employer_contribution');

    const totalEarnings = money(sum(finalEarnings.map((l) => l.amount)));
    const nonTaxable = money(sum(finalEarnings.filter((l) => !l.is_taxable).map((l) => l.amount)));
    const totalDeductions = money(sum(finalDeductions.map((l) => l.amount)));
    const totalEmployer = money(sum(finalEmployer.map((l) => l.amount)));
    const netPay = money(totalEarnings - totalDeductions);

    lines.forEach((l, i) => { l.sequence = i + 1; });

    // --- Persist ---
    const payslip = await Payslip.query(trx).insert({
        payroll_run_id: run.id,
        employee_id: employeeId,
        compensation_id: comp.id,
        pay_rate: toNum(comp.pay_rate),
        rate_type: comp.rate_type,
        monthly_equivalent: monthlyEq,
        days_worked: att.worked_days,
        hours_worked: att.worked_hours,
        days_absent: att.absent_days,
        late_minutes: att.late_minutes,
        undertime_minutes: att.undertime_minutes,
        overtime_hours: att.overtime_hours,
        basic_pay: money(basicAmount),
        total_earnings: totalEarnings,
        gross_pay: totalEarnings,
        taxable_income: taxableIncome,
        non_taxable_income: nonTaxable,
        total_deductions: totalDeductions,
        total_employer_contributions: totalEmployer,
        withholding_tax: money(wtaxAmount),
        net_pay: netPay,
        status: 'calculated',
        payment_method: comp.payment_method || 'bank_transfer',
        created_by: actorId,
        updated_by: actorId,
    });

    const appliedAdjIds = [];
    const lineRows = lines.map((l) => {
        const { _adjustmentId, ...rest } = l;
        if (_adjustmentId) appliedAdjIds.push(_adjustmentId);
        return { ...rest, payslip_id: payslip.id, created_by: actorId, updated_by: actorId };
    });
    if (lineRows.length) await PayslipLine.query(trx).insert(lineRows);

    if (appliedAdjIds.length) {
        await PayslipAdjustment.query(trx)
            .patch({ status: 'applied', applied_payslip_id: payslip.id, updated_by: actorId })
            .whereIn('id', appliedAdjIds);
    }

    return {
        skipped: false,
        summary: {
            employee_id: employeeId,
            payslip_id: payslip.id,
            gross_pay: totalEarnings,
            taxable_income: taxableIncome,
            total_deductions: totalDeductions,
            total_employer_contributions: totalEmployer,
            net_pay: netPay,
        },
    };
}

/* ============================================================
 * Attendance
 * ========================================================== */

async function aggregateAttendance(trx, employeeId, start, end, otEnabled = false) {
    const rows = await trx('attendance.attendance_logs')
        .where('employee_id', employeeId)
        .andWhere('is_deleted', false)
        .andWhere('log_date', '>=', start)
        .andWhere('log_date', '<=', end)
        .select(
            'log_date', 'status', 'time_in', 'time_out',
            'scheduled_hours', 'late_minutes', 'undertime_minutes',
            'is_rest_day', 'is_holiday',
        );

    let workedDays = 0;
    let workedHours = 0;
    let absentDays = 0;
    let lateMinutes = 0;
    let undertimeMinutes = 0;
    const loggedDates = new Set();

    for (const r of rows) {
        loggedDates.add(String(r.log_date).substring(0, 10));

        if (r.status === 'present' || r.status === 'late') workedDays += 1;
        else if (r.status === 'half_day') workedDays += 0.5;
        else if (r.status === 'absent') absentDays += 1;

        // Prefer the schedule-derived figures persisted at punch time; fall back
        // to a punch-derived estimate only for pre-schedule rows that were never
        // stamped (schedule_id / late_minutes null).
        if (r.late_minutes != null || r.undertime_minutes != null) {
            lateMinutes += toNum(r.late_minutes);
            undertimeMinutes += toNum(r.undertime_minutes);
        } else if (r.status === 'late' && r.time_in) {
            lateMinutes += minutesPastCutoff(r.time_in, LATE_CUTOFF);
        }

        if (r.time_in && r.time_out) {
            const ms = new Date(r.time_out).getTime() - new Date(r.time_in).getTime();
            if (ms > 0) {
                let hrs = ms / 3600000;
                // Attendance never pays past the scheduled shift — overtime must
                // be filed (credited separately below).
                const cap = toNum(r.scheduled_hours);
                if (cap > 0 && !r.is_rest_day && !r.is_holiday) hrs = Math.min(hrs, cap);
                workedHours += hrs;
            }
        }
    }

    // Safety net: a scheduled workday with no log at all and no approved leave is
    // an absence, even if the nightly markAbsent job hasn't reconciled it yet.
    const scheduledDates = (await scheduledWorkdaysByEmployee(trx, [employeeId], start, end))
        .get(Number(employeeId)) || [];
    if (scheduledDates.length) {
        const leaveDates = await LeaveRequest.approvedDatesInRange(trx, employeeId, start, end);
        for (const d of scheduledDates) {
            if (!loggedDates.has(d) && !leaveDates.has(d)) absentDays += 1;
        }
    }

    // OT is never inferred from long punches — only approved filings count, and only
    // while the Overtime feature flag is on.
    const overtimeHours = otEnabled
        ? await OvertimeRequest.approvedHoursForPeriod(trx, employeeId, start, end)
        : 0;

    return {
        worked_days: round2(workedDays),
        worked_hours: round2(workedHours),
        absent_days: round2(absentDays),
        scheduled_days: scheduledDates.length,
        late_minutes: Math.round(lateMinutes),
        undertime_minutes: Math.round(undertimeMinutes),
        overtime_hours: round2(overtimeHours),
    };
}

function computeBasicPay({ comp, monthlyEq, perMonth, att, dailyRate }) {
    const rate = toNum(comp.pay_rate);

    if (comp.rate_type === 'hourly') {
        return { quantity: round2(att.worked_hours), rate, amount: money(att.worked_hours * rate) };
    }
    if (comp.rate_type === 'daily') {
        return { quantity: round2(att.worked_days), rate, amount: money(att.worked_days * rate) };
    }
    // Salaried (monthly / semi_monthly): pay the fixed period base; absences &
    // tardiness are subtracted as their own explicit deduction lines.
    const periodBase = money(safeDiv(monthlyEq, perMonth));
    return { quantity: 1, rate: periodBase, amount: periodBase };
}

/* ============================================================
 * Statutory helpers — all figures come from payroll.statutory_tables
 * ========================================================== */

function computeStatutory({ monthlyEq, statutory, contribFactor }) {
    const employeeLines = [];
    const employerLines = [];
    const base = toNum(monthlyEq);

    const emit = (table, codes) => {
        if (!table) return;
        const { employee, employer, ec } = computeContribution(base, table);
        if (employee > 0) employeeLines.push(mkLine(codes.ee[0], codes.ee[1], money(employee * contribFactor)));
        if (employer > 0) employerLines.push(mkLine(codes.er[0], codes.er[1], money(employer * contribFactor)));
        if (ec > 0 && codes.ec) employerLines.push(mkLine(codes.ec[0], codes.ec[1], money(ec * contribFactor)));
    };

    emit(statutory.sss, {
        ee: ['SSS_EE', 'SSS Contribution (EE)'],
        er: ['SSS_ER', 'SSS Contribution (ER)'],
        ec: ['SSS_EC', 'SSS EC (ER)'],
    });
    emit(statutory.phic, {
        ee: ['PHIC_EE', 'PhilHealth Contribution (EE)'],
        er: ['PHIC_ER', 'PhilHealth Contribution (ER)'],
    });
    emit(statutory.hdmf, {
        ee: ['HDMF_EE', 'Pag-IBIG Contribution (EE)'],
        er: ['HDMF_ER', 'Pag-IBIG Contribution (ER)'],
    });

    return { employeeLines, employerLines };

    function mkLine(code, label, amount) {
        return { code, label, quantity: 1, rate: amount, amount };
    }
}

// Clamp a salary to [salary_floor, salary_ceiling] and round it to salary_rounding.
function capSalary(salary, table) {
    let s = toNum(salary);
    const floor = toNum(table.salary_floor);
    const ceiling = toNum(table.salary_ceiling);
    if (floor > 0) s = Math.max(s, floor);
    if (ceiling > 0) s = Math.min(s, ceiling);
    const step = toNum(table.salary_rounding);
    if (step > 0) s = Math.round(s / step) * step;
    return s;
}

const withinBand = (value, b) => {
    const lo = toNum(b.lower_bound);
    const hi = (b.upper_bound === null || b.upper_bound === undefined) ? Infinity : toNum(b.upper_bound);
    return value >= lo && value <= hi;
};

/**
 * Monthly SSS / PhilHealth / Pag-IBIG contribution from a structured statutory table.
 * Returns { employee, employer, ec } in pesos (monthly).
 */
function computeContribution(monthly, table) {
    if (!table) return { employee: 0, employer: 0, ec: 0 };
    const brackets = asArray(table.brackets);

    if (table.computation_type === 'fixed_bracket') {
        const b = brackets.find((x) => withinBand(monthly, x));
        if (!b) return { employee: 0, employer: 0, ec: 0 };
        return {
            employee: toNum(b.employee_amount),
            employer: toNum(b.employer_amount),
            ec: b.ec_amount !== null && b.ec_amount !== undefined ? toNum(b.ec_amount) : toNum(table.ec_amount),
        };
    }

    if (table.computation_type === 'tiered_percentage') {
        const capped = capSalary(monthly, table);
        const tier = brackets.find((x) => withinBand(monthly, x)) || brackets[brackets.length - 1];
        if (!tier) return { employee: 0, employer: 0, ec: 0 };
        return {
            employee: round2(capped * toNum(tier.employee_rate)),
            employer: round2(capped * toNum(tier.employer_rate)),
            ec: toNum(table.ec_amount),
        };
    }

    // flat_percentage (default)
    const capped = capSalary(monthly, table);
    return {
        employee: round2(capped * toNum(table.employee_rate)),
        employer: round2(capped * toNum(table.employer_rate)),
        ec: toNum(table.ec_amount),
    };
}

/**
 * Withholding tax. `tax_bracket` rows carry base_tax + tax_rate on the excess over lower_bound.
 * The period taxable is scaled to a monthly figure, taxed, then scaled back down.
 */
function computeWithholdingTax(periodTaxable, perMonth, table) {
    if (!table || table.computation_type !== 'tax_bracket') return 0;
    const brackets = asArray(table.brackets);
    if (!brackets.length) return 0;

    const monthlyTaxable = toNum(periodTaxable) * perMonth;
    const b = brackets.find((x) => withinBand(monthlyTaxable, x)) || brackets[brackets.length - 1];

    const monthlyTax = toNum(b.base_tax) + (monthlyTaxable - toNum(b.lower_bound)) * toNum(b.tax_rate);
    if (monthlyTax <= 0) return 0;
    return money(monthlyTax / perMonth);
}

/* ============================================================
 * Small utilities
 * ========================================================== */

function normalizeLine(p, componentByCode) {
    const comp = p.code && componentByCode ? componentByCode.get(p.code) : null;
    return {
        component_id: p.component_id != null ? p.component_id : (comp ? comp.id : null),
        assignment_id: p.assignment_id != null ? p.assignment_id : null,
        code: p.code != null ? p.code : (comp ? comp.code : null),
        label: p.label != null ? p.label : (comp ? comp.name : 'Item'),
        line_type: p.line_type,
        source: p.source || 'system',
        quantity: round4(toNum(p.quantity != null ? p.quantity : 1)),
        rate: round4(toNum(p.rate)),
        amount: money(toNum(p.amount)),
        is_taxable: p.is_taxable != null ? !!p.is_taxable : (comp ? !!comp.is_taxable : false),
        is_statutory: p.is_statutory != null ? !!p.is_statutory : (comp ? !!comp.is_statutory : false),
        sequence: 0,
        metadata: p.metadata || null,
        _adjustmentId: p._adjustmentId || null,
    };
}

function minutesPastCutoff(timeIn, cutoff) {
    const d = new Date(timeIn);
    if (Number.isNaN(d.getTime())) return 0;
    const [ch, cm] = cutoff.split(':').map(Number);
    const actual = d.getHours() * 60 + d.getMinutes();
    return Math.max(0, actual - (ch * 60 + cm));
}

function resolveRef(ref) {
    const str = String(ref || '').trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) return { uuid: str };
    const n = Number(str);
    if (Number.isInteger(n) && n > 0) return { id: n };
    return { uuid: str }; // let the lookup miss cleanly
}

function httpError(status, message) {
    const err = new Error(message);
    err.status = status;
    return err;
}

const asArray = (v) => (Array.isArray(v) ? v : []);
const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round((toNum(n) + Number.EPSILON) * 100) / 100;
const round4 = (n) => Math.round((toNum(n) + Number.EPSILON) * 10000) / 10000;
const money = round2;
const sum = (arr) => arr.reduce((a, b) => a + toNum(b), 0);
const safeDiv = (a, b) => (toNum(b) === 0 ? 0 : toNum(a) / toNum(b));

module.exports = {
    calculateRun,
    // exported for unit testing
    _internals: {
        computeContribution, computeWithholdingTax, capSalary, withinBand,
        computeBasicPay, aggregateAttendance, minutesPastCutoff, PERIODS_PER_MONTH,
    },
};
