/* eslint-disable react-refresh/only-export-components -- small shared helpers colocated with these tiny presentational bits */
import { CATEGORICAL } from './chartTheme';

/** Loading placeholder for a report body (tiles + charts). */
export function ReportSkeleton() {
    return (
        <div className="animate-pulse space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-24 rounded-xl border border-slate-200 bg-white" />
                ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-72 rounded-xl border border-slate-200 bg-white" />
                ))}
            </div>
        </div>
    );
}

/** Coloured pill for a category / status value. */
export function Tag({ value, tone }) {
    const cls = tone || 'bg-slate-100 text-slate-600';
    return (
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${cls}`}>
            {String(value ?? '—').replace(/_/g, ' ')}
        </span>
    );
}

export const seriesColor = (i) => CATEGORICAL[i % CATEGORICAL.length];

export const nf = new Intl.NumberFormat('en-PH');
export const fmtNum = (v) => nf.format(Math.round((Number(v) + Number.EPSILON) * 100) / 100);
