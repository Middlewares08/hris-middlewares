import { useState } from 'react';
import { PlusIcon, Save, ShieldAlert, Trash, CalendarClock, Star } from 'lucide-react';
import { CustomDataTable } from '../../components/CustomDataTable';
import CustomModal from '../../components/CustomModal';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import CustomLabel from '../../components/CustomLabel';
import CustomSelection from '../../components/CustomSelection';
import NotFound from '../../components/NotFound';
import { can } from '../../utils/permissionCheck';
import { useWorkSchedules } from '../../hooks/useWorkSchedules';

const VIEW = 'shift-and-rostering:view';

// 0=Sun … 6=Sat (matches the backend weekday convention); shown Monday-first.
const WEEKDAYS = [
    { wd: 1, label: 'Monday', short: 'Mon' },
    { wd: 2, label: 'Tuesday', short: 'Tue' },
    { wd: 3, label: 'Wednesday', short: 'Wed' },
    { wd: 4, label: 'Thursday', short: 'Thu' },
    { wd: 5, label: 'Friday', short: 'Fri' },
    { wd: 6, label: 'Saturday', short: 'Sat' },
    { wd: 0, label: 'Sunday', short: 'Sun' },
];

const s = (v) => (v === null || v === undefined ? '' : String(v));
const hhmm = (t) => (t ? String(t).slice(0, 5) : '');

const blankDays = () =>
    WEEKDAYS.map(({ wd }) => ({
        weekday: wd,
        is_workday: wd >= 1 && wd <= 5,
        start_time: wd >= 1 && wd <= 5 ? '09:00' : '',
        end_time: wd >= 1 && wd <= 5 ? '18:00' : '',
        break_minutes: 60,
    }));

const BLANK = {
    name: '', description: '', grace_minutes: '15', half_day_hours: '4',
    is_default: false, is_active: true, days: blankDays(),
};

const toForm = (row) => ({
    name: s(row.name),
    description: s(row.description),
    grace_minutes: s(row.grace_minutes ?? 0),
    half_day_hours: s(row.half_day_hours ?? 4),
    is_default: !!row.is_default,
    is_active: row.is_active !== false,
    uuid: row.uuid,
    days: WEEKDAYS.map(({ wd }) => {
        const d = (row.days || []).find((x) => Number(x.weekday) === wd) || {};
        return {
            weekday: wd,
            is_workday: !!d.is_workday,
            start_time: hhmm(d.start_time),
            end_time: hhmm(d.end_time),
            break_minutes: d.break_minutes ?? 60,
        };
    }),
});

// Net paid hours for a day row (handles a shift that crosses midnight).
const dayHours = (d) => {
    if (!d.is_workday || !d.start_time || !d.end_time) return 0;
    const [sh, sm] = d.start_time.split(':').map(Number);
    const [eh, em] = d.end_time.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins <= 0) mins += 24 * 60;
    return Math.max(0, Math.round((mins - (Number(d.break_minutes) || 0)) / 6) / 10);
};

const summarise = (days) => {
    const work = (days || []).filter((d) => d.is_workday);
    if (!work.length) return 'No working days';
    const total = work.reduce((sum, d) => sum + Number(dayHours(d) || d.scheduled_hours || 0), 0);
    return `${work.length} day${work.length > 1 ? 's' : ''}/wk · ~${Math.round(total * 10) / 10}h total`;
};

function WorkSchedule() {
    const { items, isLoading, error, create, update, remove, isMutating } = useWorkSchedules();
    const [form, setForm] = useState(null);
    const [toDelete, setToDelete] = useState(null);

    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
    const setDay = (wd, patch) =>
        setForm((p) => ({
            ...p,
            days: p.days.map((d) => (d.weekday === wd ? { ...d, ...patch } : d)),
        }));

    const validationError = () => {
        if (!form.name.trim()) return 'Name is required.';
        for (const d of form.days) {
            if (d.is_workday && (!d.start_time || !d.end_time)) {
                const lbl = WEEKDAYS.find((w) => w.wd === d.weekday)?.label;
                return `${lbl}: set both a start and end time, or mark it a rest day.`;
            }
        }
        return null;
    };

    const submit = async () => {
        const err = validationError();
        if (err) return;
        const payload = {
            name: form.name.trim(),
            description: form.description.trim() || null,
            grace_minutes: Number(form.grace_minutes) || 0,
            half_day_hours: Number(form.half_day_hours) || 0,
            is_default: form.is_default,
            is_active: form.is_active,
            days: form.days.map((d) => ({
                weekday: d.weekday,
                is_workday: d.is_workday,
                start_time: d.is_workday ? d.start_time : null,
                end_time: d.is_workday ? d.end_time : null,
                break_minutes: Number(d.break_minutes) || 0,
            })),
        };
        try {
            if (form.uuid) await update({ uuid: form.uuid, payload });
            else await create(payload);
            setForm(null);
        } catch { /* toast handled in hook */ }
    };

    const columns = [
        {
            header: 'Schedule',
            render: (r) => (
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-600">
                        <CalendarClock size={16} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 font-semibold text-slate-900">
                            {r.name}
                            {r.is_default && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600">
                                    <Star size={10} /> Default
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-slate-400">{summarise(r.days)}</div>
                    </div>
                </div>
            ),
        },
        { header: 'Grace', render: (r) => `${r.grace_minutes ?? 0} min` },
        { header: 'Half-day under', render: (r) => `${r.half_day_hours ?? 4} h` },
        { header: 'Status', render: (r) => (r.is_active ? 'Active' : 'Inactive') },
    ];

    const drawer = (row, close) => (
        <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-lg font-bold text-slate-900">{row.name}</p>
                {row.description && <p className="mt-1 text-sm text-slate-600">{row.description}</p>}
                <p className="mt-2 text-xs text-slate-400">{summarise(row.days)} · {row.grace_minutes ?? 0} min grace</p>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-100">
                {WEEKDAYS.map(({ wd, label }) => {
                    const d = (row.days || []).find((x) => Number(x.weekday) === wd) || {};
                    return (
                        <div key={wd} className="flex items-center justify-between border-b border-slate-50 px-3 py-2 text-sm last:border-0">
                            <span className="text-slate-600">{label}</span>
                            {d.is_workday
                                ? <span className="font-medium text-slate-800">{hhmm(d.start_time)}–{hhmm(d.end_time)} <span className="text-slate-400">({d.break_minutes || 0}m break)</span></span>
                                : <span className="text-slate-300">Rest day</span>}
                        </div>
                    );
                })}
            </div>
            <div className="flex gap-2">
                {can('shift-and-rostering:edit') && (
                    <CustomButton
                        children="Edit"
                        onClick={() => { close(); setForm(toForm(row)); }}
                        className="flex-1 rounded border border-slate-200 bg-white! py-2 text-xs text-blue-700! hover:bg-blue-50!"
                    />
                )}
                {can('shift-and-rostering:delete') && !row.is_default && (
                    <CustomButton
                        children="Archive"
                        onClick={() => { close(); setToDelete(row); }}
                        className="flex-1 rounded border border-rose-200 bg-rose-50! py-2 text-xs text-rose-600! hover:bg-rose-100!"
                    />
                )}
            </div>
        </div>
    );

    if (!can(VIEW)) return <NotFound />;

    const vErr = form ? validationError() : null;

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="border-b border-slate-100 pb-4">
                <CustomLabel
                    variant="h2"
                    addedClass="font-bold text-slate-700!"
                    descriptionClass="text-xs"
                    description="Weekly shift patterns. Late detection, undertime, absence and the attendance rate are all measured against the employee's assigned schedule."
                    children="Work Schedules"
                />
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    <ShieldAlert size={16} /> {error}
                </div>
            )}

            <CustomDataTable
                data={items}
                columns={columns}
                isLoading={isLoading}
                searchPlaceholder="Search schedules..."
                renderDrawerContent={drawer}
                actionButton={can('shift-and-rostering:create') && (
                    <CustomButton
                        children="Add Schedule"
                        onClick={() => setForm({ ...BLANK, days: blankDays() })}
                        icon={PlusIcon}
                        iconPosition="left"
                        className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white shadow-xs transition-colors hover:cursor-pointer hover:bg-slate-600"
                    />
                )}
            />

            <CustomModal
                isOpen={!!form}
                onClose={() => setForm(null)}
                title={form?.uuid ? 'Edit Work Schedule' : 'New Work Schedule'}
                size="xl"
                showCloseButton
                hasRequiredFields
                footer={(
                    <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                        <span className="text-xs text-rose-500">{vErr || ''}</span>
                        <CustomButton
                            children={form?.uuid ? 'Save Changes' : 'Create Schedule'}
                            onClick={submit}
                            icon={Save}
                            iconPosition="left"
                            isLoading={isMutating}
                            disabled={isMutating || !!vErr}
                            className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white shadow-xs transition-colors hover:cursor-pointer hover:bg-slate-600 disabled:opacity-50"
                        />
                    </div>
                )}
            >
                {form && (
                    <div className="max-h-[65vh] space-y-4 overflow-y-auto px-1 pb-2">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <CustomInput
                                label="Name" isRequired
                                value={s(form.name)}
                                placeholder="e.g. Night Shift (Sun–Thu)"
                                onChange={(e) => set('name', e.target.value)}
                            />
                            <CustomInput
                                label="Description"
                                value={s(form.description)}
                                placeholder="Optional"
                                onChange={(e) => set('description', e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <CustomInput
                                label="Grace period (minutes)" type="number"
                                value={s(form.grace_minutes)}
                                onChange={(e) => set('grace_minutes', e.target.value)}
                            />
                            <CustomInput
                                label="Half-day if worked under (hours)" type="number"
                                value={s(form.half_day_hours)}
                                onChange={(e) => set('half_day_hours', e.target.value)}
                            />
                        </div>

                        <div className="overflow-hidden rounded-xl border border-slate-200">
                            <div className="grid grid-cols-[1.2fr_0.8fr_0.9fr_0.9fr_0.8fr] gap-2 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                <span>Day</span><span>Working</span><span>Start</span><span>End</span><span>Break (m)</span>
                            </div>
                            {form.days.map((d) => {
                                const label = WEEKDAYS.find((w) => w.wd === d.weekday)?.label;
                                return (
                                    <div key={d.weekday} className="grid grid-cols-[1.2fr_0.8fr_0.9fr_0.9fr_0.8fr] items-center gap-2 border-t border-slate-100 px-3 py-2 text-sm">
                                        <span className="font-medium text-slate-700">
                                            {label}
                                            {d.is_workday && d.start_time && d.end_time && (
                                                <span className="ml-1 text-[11px] text-slate-400">{dayHours(d)}h</span>
                                            )}
                                        </span>
                                        <CustomSelection
                                            label=""
                                            checked={d.is_workday}
                                            onChange={(v) => setDay(d.weekday, {
                                                is_workday: v,
                                                start_time: v ? (d.start_time || '09:00') : '',
                                                end_time: v ? (d.end_time || '18:00') : '',
                                            })}
                                            indicatorPosition="left"
                                        />
                                        <input
                                            type="time" disabled={!d.is_workday} value={d.start_time}
                                            onChange={(e) => setDay(d.weekday, { start_time: e.target.value })}
                                            className="rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-300"
                                        />
                                        <input
                                            type="time" disabled={!d.is_workday} value={d.end_time}
                                            onChange={(e) => setDay(d.weekday, { end_time: e.target.value })}
                                            className="rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-300"
                                        />
                                        <input
                                            type="number" min="0" disabled={!d.is_workday} value={d.break_minutes}
                                            onChange={(e) => setDay(d.weekday, { break_minutes: e.target.value })}
                                            className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-300"
                                        />
                                    </div>
                                );
                            })}
                            <p className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-400">
                                An end time earlier than the start time is treated as a shift that runs past midnight.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <CustomSelection label="Set as the default schedule" checked={form.is_default} onChange={(v) => set('is_default', v)} indicatorPosition="left" className="text-left" />
                            <CustomSelection label="Active" checked={form.is_active} onChange={(v) => set('is_active', v)} indicatorPosition="left" className="text-left" />
                        </div>
                        {form.is_default && (
                            <p className="text-xs text-amber-600">This replaces the current default. Employees with no explicit assignment use the default schedule.</p>
                        )}
                    </div>
                )}
            </CustomModal>

            <CustomModal isOpen={!!toDelete} onClose={() => setToDelete(null)} title="Archive schedule?" size="md">
                <div className="p-2 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-rose-100 bg-rose-50 text-rose-500">
                        <ShieldAlert size={26} />
                    </div>
                    <p className="mb-6 text-sm text-slate-500">
                        Archive <span className="font-semibold text-slate-800">{toDelete?.name}</span>? Employees currently on it fall back to the default schedule.
                    </p>
                    <div className="flex gap-3 border-t border-slate-100 pt-4">
                        <CustomButton onClick={() => setToDelete(null)} className="flex-1 border border-slate-200 bg-white! text-slate-700! hover:bg-slate-100!">Cancel</CustomButton>
                        <CustomButton
                            variant="danger" icon={Trash} iconPosition="left" isLoading={isMutating}
                            onClick={async () => { try { await remove(toDelete.uuid); setToDelete(null); } catch { /* handled */ } }}
                            className="flex-1"
                        >
                            Archive
                        </CustomButton>
                    </div>
                </div>
            </CustomModal>
        </div>
    );
}

export default WorkSchedule;
