import { RefreshCw, Download, ShieldAlert } from 'lucide-react';

/**
 * Standard chrome for a single report page: title, an optional date-range
 * filter, Refresh + Export CSV actions, and loading / error handling. The
 * report body is `children`.
 */
function ReportShell({
    title,
    description,
    range,           // { from, to } | null to hide the range filter
    onFromChange,
    onToChange,
    onExport,        // () => void ; omit to hide the export button
    canExport = true,
    isFetching = false,
    error = null,
    onRetry,
    extraActions = null,
    children,
}) {
    return (
        <div className="space-y-5 text-left">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">{title}</h2>
                    {description ? <p className="mt-0.5 text-xs text-slate-400">{description}</p> : null}
                </div>

                <div className="flex flex-wrap items-end gap-2">
                    {range && (
                        <>
                            <label className="flex flex-col text-[11px] font-medium text-slate-400">
                                From
                                <input
                                    type="date"
                                    value={range.from || ''}
                                    max={range.to || undefined}
                                    onChange={(e) => onFromChange?.(e.target.value)}
                                    className="mt-0.5 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:outline-slate-400"
                                />
                            </label>
                            <label className="flex flex-col text-[11px] font-medium text-slate-400">
                                To
                                <input
                                    type="date"
                                    value={range.to || ''}
                                    min={range.from || undefined}
                                    onChange={(e) => onToChange?.(e.target.value)}
                                    className="mt-0.5 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:outline-slate-400"
                                />
                            </label>
                        </>
                    )}

                    {extraActions}

                    {onExport && (
                        <button
                            type="button"
                            onClick={onExport}
                            disabled={!canExport}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                            <Download size={12} /> Export CSV
                        </button>
                    )}

                    {onRetry && (
                        <button
                            type="button"
                            onClick={() => onRetry()}
                            disabled={isFetching}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} /> Refresh
                        </button>
                    )}
                </div>
            </div>

            {error ? (
                <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    <ShieldAlert size={18} className="mt-0.5 shrink-0" />
                    <div>
                        <p className="font-semibold">Couldn&apos;t load this report</p>
                        <p className="text-rose-600">{error}</p>
                        {onRetry && (
                            <button
                                type="button"
                                onClick={() => onRetry()}
                                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                            >
                                <RefreshCw size={12} /> Retry
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                children
            )}
        </div>
    );
}

export default ReportShell;
