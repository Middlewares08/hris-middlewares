import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { CalendarClock, Check } from 'lucide-react';
import CustomButton from '../../components/CustomButton';
import CustomDropdown from '../../components/CustomDropdown';
import CustomDatePicker from '../../components/CustomDatePicker';
import { can } from '../../utils/permissionCheck';
import { useEmployeeSchedule, useWorkScheduleOptions } from '../../hooks/useWorkSchedules';

const WEEKDAYS = [
    { wd: 1, s: 'Mon' }, { wd: 2, s: 'Tue' }, { wd: 3, s: 'Wed' }, { wd: 4, s: 'Thu' },
    { wd: 5, s: 'Fri' }, { wd: 6, s: 'Sat' }, { wd: 0, s: 'Sun' },
];
const hhmm = (t) => (t ? String(t).slice(0, 5) : '');
const ymd = (d) => {
    const x = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(x.getTime())) return String(d).slice(0, 10);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

/**
 * "Work Schedule" block in the employee detail drawer — shows the employee's
 * current schedule (weekly pattern) and lets HR assign a different one from a
 * chosen effective date.
 */
export default function EmployeeScheduleSection({ employee }) {
    const employeeId = employee?.id;
    const { current, isLoading, assign, isAssigning } = useEmployeeSchedule(employeeId);
    const { options } = useWorkScheduleOptions(can('shift-and-rostering:view'));

    const [editing, setEditing] = useState(false);
    const [scheduleUuid, setScheduleUuid] = useState('');
    const [effectiveDate, setEffectiveDate] = useState(ymd(new Date()));

    const scheduleOptions = useMemo(
        () => options.map((o) => ({ label: `${o.name}${o.is_default ? ' (default)' : ''}`, value: o.uuid })),
        [options],
    );

    if (!can('shift-and-rostering:view')) return null;

    const days = current?.schedule?.days || [];
    const workdays = days.filter((d) => d.is_workday);

    const save = async () => {
        if (!scheduleUuid) return;
        try {
            await assign({ schedule_uuid: scheduleUuid, effective_date: effectiveDate });
            setEditing(false);
            setScheduleUuid('');
        } catch { /* toast handled in hook */ }
    };

    return (
        <div className="space-y-3">
            <h5 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <CalendarClock size={14} /> Work Schedule
            </h5>

            {isLoading ? (
                <div className="h-16 animate-pulse rounded-xl bg-slate-50" />
            ) : (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-800">
                            {current?.schedule?.name || 'Standard Day Shift (default)'}
                        </span>
                        {current?.effective_date && (
                            <span className="text-[11px] text-slate-400">since {ymd(current.effective_date)}</span>
                        )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                        {WEEKDAYS.map(({ wd, s }) => {
                            const d = days.find((x) => Number(x.weekday) === wd);
                            const on = d?.is_workday;
                            return (
                                <span
                                    key={wd}
                                    title={on ? `${hhmm(d.start_time)}–${hhmm(d.end_time)}` : 'Rest day'}
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                        on ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-400'
                                    }`}
                                >
                                    {s}
                                </span>
                            );
                        })}
                    </div>
                    {workdays[0] && (
                        <p className="mt-1.5 text-[11px] text-slate-400">
                            {hhmm(workdays[0].start_time)}–{hhmm(workdays[0].end_time)} · {workdays[0].break_minutes || 0}m break
                            {current?.schedule && ` · ${current.schedule.grace_minutes ?? 0}m grace`}
                        </p>
                    )}
                </div>
            )}

            {can('shift-and-rostering:edit') && !editing && (
                <CustomButton
                    children={current ? 'Change schedule' : 'Assign schedule'}
                    onClick={() => setEditing(true)}
                    className="w-full rounded-lg border border-slate-200 bg-white! py-2 text-xs font-semibold text-blue-700! hover:bg-blue-50!"
                />
            )}

            {editing && (
                <div className="space-y-3 rounded-xl border border-slate-200 p-3">
                    <CustomDropdown
                        label="Schedule"
                        options={scheduleOptions}
                        value={scheduleUuid}
                        renderProps="label"
                        returnProps="value"
                        onChange={(v) => setScheduleUuid(v)}
                        className="w-full items-start!"
                    />
                    <CustomDatePicker
                        label="Effective date"
                        value={effectiveDate ? new Date(`${effectiveDate}T00:00:00`) : null}
                        onChange={(d) => setEffectiveDate(d ? ymd(d) : '')}
                    />
                    <p className="text-[11px] text-slate-400">
                        The current assignment is closed the day before. Existing attendance logs are not recomputed.
                    </p>
                    <div className="flex gap-2">
                        <CustomButton
                            children="Cancel"
                            onClick={() => { setEditing(false); setScheduleUuid(''); }}
                            className="flex-1 border border-slate-200 bg-white! py-2 text-xs text-slate-700! hover:bg-slate-100!"
                        />
                        <CustomButton
                            children="Assign"
                            icon={Check}
                            iconPosition="left"
                            isLoading={isAssigning}
                            disabled={isAssigning || !scheduleUuid}
                            onClick={save}
                            className="flex-1 bg-slate-700 py-2 text-xs text-white disabled:opacity-50"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

EmployeeScheduleSection.propTypes = {
    employee: PropTypes.object,
};
