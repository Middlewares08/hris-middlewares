import { TimerOff } from 'lucide-react';
import { useSettings } from '../../hooks/useSystem';
import { can } from '../../utils/permissionCheck';

/**
 * Master switch for the nightly autoClockOut job. When on (default), forgotten
 * time-outs are stamped closed automatically. When off, the job is a no-op and
 * open punches stay open for a manager to close manually.
 */
export default function AutoClockOutToggle() {
    const { values, isLoading, updateSetting, isSaving } = useSettings();
    const on = values['attendance.auto_clock_out_enabled'] !== false; // default true
    const canEdit = can('attendance-logs:edit');
    const busy = !canEdit || isLoading || isSaving;

    if (!can(['attendance-logs:view', 'attendance-logs:edit'])) return null;

    return (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${on ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    <TimerOff size={16} />
                </div>
                <div>
                    <p className="text-sm font-semibold text-slate-800">Auto clock-out</p>
                    <p className="text-xs text-slate-400">
                        {on
                            ? 'Forgotten time-outs are closed automatically each night, capped and flagged for review.'
                            : 'Off — punches with no time-out stay open until a manager closes them manually.'}
                    </p>
                </div>
            </div>
            <button
                type="button"
                disabled={busy}
                onClick={() => updateSetting({ key: 'attendance.auto_clock_out_enabled', value: !on })}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}
                aria-pressed={on}
                title={canEdit ? 'Toggle auto clock-out' : 'Requires attendance-logs:edit'}
            >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
        </div>
    );
}
