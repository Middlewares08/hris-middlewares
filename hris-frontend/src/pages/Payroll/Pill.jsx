import { STATUS_TONE } from './payrollOptions';

// Status pill shared across the admin payroll pages.
export default function Pill({ value }) {
    return (
        <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                STATUS_TONE[value] || 'bg-slate-100 text-slate-600'
            }`}
        >
            {String(value || '').replace(/_/g, ' ')}
        </span>
    );
}
