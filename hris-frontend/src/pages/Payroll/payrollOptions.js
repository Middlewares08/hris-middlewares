// Shared option lists + formatters for the admin payroll pages.
import moment from 'moment';

export const peso = (v) =>
    '₱' + Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtDate = (v, f = 'MMM D, YYYY') => (v ? moment(v).format(f) : '—');

const opt = (value, label) => ({ id: value, value, label });

export const COMPONENT_TYPES = [
    opt('earning', 'Earning'),
    opt('deduction', 'Deduction'),
    opt('employer_contribution', 'Employer Contribution'),
];

export const CALCULATION_TYPES = [
    opt('fixed', 'Fixed amount'),
    opt('hourly_rate', 'Hourly rate'),
    opt('daily_rate', 'Daily rate'),
    opt('percentage_of_basic', '% of basic'),
    opt('percentage_of_gross', '% of gross'),
    opt('formula', 'Formula (engine)'),
    opt('statutory', 'Statutory'),
    opt('manual', 'Manual'),
];

export const RATE_TYPES = [
    opt('monthly', 'Monthly'),
    opt('semi_monthly', 'Semi-monthly'),
    opt('daily', 'Daily'),
    opt('hourly', 'Hourly'),
];

export const PAY_FREQUENCIES = [
    opt('monthly', 'Monthly'),
    opt('semi_monthly', 'Semi-monthly'),
    opt('weekly', 'Weekly'),
    opt('bi_weekly', 'Bi-weekly'),
];

export const PERIOD_SEQUENCES = [
    opt('first_cutoff', 'First cutoff'),
    opt('second_cutoff', 'Second cutoff'),
    opt('monthly', 'Monthly'),
    opt('special', 'Special'),
];

export const PERIOD_STATUSES = [opt('open', 'Open'), opt('locked', 'Locked'), opt('closed', 'Closed')];

export const PAYMENT_METHODS = [
    opt('bank_transfer', 'Bank transfer'),
    opt('cash', 'Cash'),
    opt('check', 'Check'),
];

export const RUN_TYPES = [
    opt('regular', 'Regular'),
    opt('off_cycle', 'Off-cycle'),
    opt('thirteenth_month', '13th month'),
    opt('final_pay', 'Final pay'),
    opt('adjustment', 'Adjustment'),
];

export const STATUTORY_TYPES = [
    opt('sss', 'SSS'),
    opt('philhealth', 'PhilHealth'),
    opt('pagibig', 'Pag-IBIG'),
    opt('withholding_tax', 'Withholding Tax'),
];

export const STATUTORY_FREQUENCIES = [
    opt('monthly', 'Monthly'),
    opt('semi_monthly', 'Semi-monthly'),
    opt('annual', 'Annual'),
];

export const COMPUTATION_TYPES = [
    opt('flat_percentage', 'Flat percentage'),
    opt('tiered_percentage', 'Tiered percentage'),
    opt('fixed_bracket', 'Fixed amount per bracket'),
    opt('tax_bracket', 'Tax bracket (base + rate on excess)'),
];

export const COMPUTATION_HELP = {
    flat_percentage: 'One employee & employer rate applied to the salary (kept within the floor/ceiling). Used for SSS and PhilHealth.',
    tiered_percentage: 'The rate changes depending on which salary band the employee falls in. Used for Pag-IBIG.',
    fixed_bracket: 'A fixed peso amount for each salary band — a real contribution table.',
    tax_bracket: 'Each band has a base tax plus a rate charged on the amount above the band’s lower limit. Used for withholding tax.',
};

export const ADJUSTMENT_TYPES = [opt('earning', 'Earning'), opt('deduction', 'Deduction')];

// tone classes for status pills, keyed by status value across runs / periods / payslips / adjustments
export const STATUS_TONE = {
    draft: 'bg-slate-100 text-slate-600',
    calculating: 'bg-amber-100 text-amber-700',
    calculated: 'bg-sky-100 text-sky-700',
    approved: 'bg-indigo-100 text-indigo-700',
    paid: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-rose-100 text-rose-700',
    open: 'bg-emerald-100 text-emerald-700',
    locked: 'bg-amber-100 text-amber-700',
    closed: 'bg-slate-200 text-slate-600',
    released: 'bg-emerald-100 text-emerald-700',
    on_hold: 'bg-amber-100 text-amber-700',
    pending: 'bg-amber-100 text-amber-700',
    applied: 'bg-emerald-100 text-emerald-700',
    fulfilled: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-rose-100 text-rose-700',
};
