import { Construction } from 'lucide-react';
import { useReport } from '../../hooks/useReports';
import ReportShell from './_shared/ReportShell';

/**
 * Placeholder for reports whose module isn't built yet (Performance, Training).
 * Still hits the endpoint so the copy comes from the server's `{ available:false }`.
 */
function ComingSoonReport({ reportKey, title, description }) {
    const { data } = useReport(reportKey);
    const message = data?.message;

    return (
        <ReportShell title={title} description={description} range={null}>
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Construction size={22} />
                </div>
                <p className="text-sm font-semibold text-slate-700">Not available yet</p>
                <p className="max-w-md text-xs text-slate-400">
                    {message || 'This report needs a module that has not been built yet.'}
                </p>
            </div>
        </ReportShell>
    );
}

export function PerformanceReport() {
    return (
        <ComingSoonReport
            reportKey="performance"
            title="Performance Report"
            description="Ratings, evaluation status and performance distribution."
        />
    );
}

export function TrainingReport() {
    return (
        <ComingSoonReport
            reportKey="training"
            title="Training Report"
            description="Training attendance, completion status and hours."
        />
    );
}

export default ComingSoonReport;
