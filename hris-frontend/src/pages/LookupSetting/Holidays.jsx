import { useMemo, useState } from 'react';
import { PlusIcon, Save, ShieldAlert, Trash, CalendarDays } from 'lucide-react';
import { CustomDataTable } from '../../components/CustomDataTable';
import CustomModal from '../../components/CustomModal';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import CustomDropdown from '../../components/CustomDropdown';
import CustomLabel from '../../components/CustomLabel';
import CustomSelection from '../../components/CustomSelection';
import CustomDatePicker from '../../components/CustomDatePicker';
import NotFound from '../../components/NotFound';
import { can } from '../../utils/permissionCheck';
import { useHolidays } from '../../hooks/useHolidays';

const VIEW = 'shift-and-rostering:view';

const TYPES = [
    { label: 'Regular holiday', value: 'regular' },
    { label: 'Special (non-working)', value: 'special_non_working' },
    { label: 'Special (working)', value: 'special_working' },
];
const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.value, t.label]));

const s = (v) => (v === null || v === undefined ? '' : String(v));
const ymd = (d) => {
    if (!d) return '';
    const x = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(x.getTime())) return String(d).slice(0, 10);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const prettyDate = (d) =>
    new Date(`${ymd(d)}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

const BLANK = { date: '', name: '', type: 'regular', is_active: true };

function Holidays() {
    const now = new Date();
    const [year, setYear] = useState(String(now.getFullYear()));
    const { items, isLoading, error, create, update, remove, isMutating } = useHolidays({ year });

    const [form, setForm] = useState(null);
    const [toDelete, setToDelete] = useState(null);
    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const years = useMemo(() => {
        const base = now.getFullYear();
        return [base - 1, base, base + 1, base + 2].map((y) => ({ label: String(y), value: String(y) }));
    }, [now]);

    const submit = async () => {
        if (!form.date || !form.name.trim()) return;
        const payload = { date: ymd(form.date), name: form.name.trim(), type: form.type, is_active: form.is_active };
        try {
            if (form.uuid) await update({ uuid: form.uuid, payload });
            else await create(payload);
            setForm(null);
        } catch { /* toast handled in hook */ }
    };

    const columns = [
        {
            header: 'Date',
            render: (r) => (
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-600">
                        <CalendarDays size={16} />
                    </div>
                    <span className="font-medium text-slate-800">{prettyDate(r.date)}</span>
                </div>
            ),
        },
        { header: 'Name', render: (r) => <span className="text-slate-700">{r.name}</span> },
        {
            header: 'Type',
            render: (r) => (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    r.type === 'regular' ? 'bg-indigo-50 text-indigo-600'
                        : r.type === 'special_non_working' ? 'bg-amber-50 text-amber-600'
                            : 'bg-slate-100 text-slate-500'
                }`}>
                    {TYPE_LABEL[r.type] || r.type}
                </span>
            ),
        },
        { header: 'Status', render: (r) => (r.is_active ? 'Active' : 'Inactive') },
    ];

    const drawer = (row, close) => (
        <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-lg font-bold text-slate-900">{row.name}</p>
                <p className="mt-1 text-sm text-slate-600">{prettyDate(row.date)}</p>
                <p className="mt-2 text-xs text-slate-400">{TYPE_LABEL[row.type] || row.type}</p>
            </div>
            {row.type !== 'special_working' && (
                <p className="text-xs text-slate-400">
                    A non-working holiday: employees are not marked absent and it is excluded from attendance-rate denominators.
                </p>
            )}
            <div className="flex gap-2">
                {can('shift-and-rostering:edit') && (
                    <CustomButton
                        children="Edit"
                        onClick={() => { close(); setForm({ ...row, date: ymd(row.date), is_active: row.is_active !== false }); }}
                        className="flex-1 rounded border border-slate-200 bg-white! py-2 text-xs text-blue-700! hover:bg-blue-50!"
                    />
                )}
                {can('shift-and-rostering:delete') && (
                    <CustomButton
                        children="Remove"
                        onClick={() => { close(); setToDelete(row); }}
                        className="flex-1 rounded border border-rose-200 bg-rose-50! py-2 text-xs text-rose-600! hover:bg-rose-100!"
                    />
                )}
            </div>
        </div>
    );

    if (!can(VIEW)) return <NotFound />;

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-4">
                <CustomLabel
                    variant="h2"
                    addedClass="font-bold text-slate-700!"
                    descriptionClass="text-xs"
                    description="Non-working days. Drives absence detection and the attendance-rate denominators. Movable holidays (Eid'l Fitr / Adha) must be added manually each year."
                    children="Holiday Calendar"
                />
                <div className="w-40">
                    <CustomDropdown
                        label="Year"
                        options={years}
                        value={year}
                        renderProps="label"
                        returnProps="value"
                        onChange={(v) => setYear(v)}
                        className="w-full items-start!"
                    />
                </div>
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
                searchPlaceholder="Search holidays..."
                renderDrawerContent={drawer}
                actionButton={can('shift-and-rostering:create') && (
                    <CustomButton
                        children="Add Holiday"
                        onClick={() => setForm({ ...BLANK })}
                        icon={PlusIcon}
                        iconPosition="left"
                        className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white shadow-xs transition-colors hover:cursor-pointer hover:bg-slate-600"
                    />
                )}
            />

            <CustomModal
                isOpen={!!form}
                onClose={() => setForm(null)}
                title={form?.uuid ? 'Edit Holiday' : 'Add Holiday'}
                size="md"
                showCloseButton
                hasRequiredFields
                footer={(
                    <div className="flex justify-center border-t border-slate-100 pt-4">
                        <CustomButton
                            children={form?.uuid ? 'Save Changes' : 'Add Holiday'}
                            onClick={submit}
                            icon={Save}
                            iconPosition="left"
                            isLoading={isMutating}
                            disabled={isMutating || !form?.date || !form?.name?.trim()}
                            className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white shadow-xs transition-colors hover:cursor-pointer hover:bg-slate-600 disabled:opacity-50"
                        />
                    </div>
                )}
            >
                {form && (
                    <div className="space-y-4 px-1 pb-2">
                        <CustomDatePicker
                            label="Date"
                            isRequired
                            value={form.date ? new Date(`${ymd(form.date)}T00:00:00`) : null}
                            onChange={(d) => set('date', ymd(d))}
                        />
                        <CustomInput
                            label="Name" isRequired
                            value={s(form.name)}
                            placeholder="e.g. Founding Anniversary"
                            onChange={(e) => set('name', e.target.value)}
                        />
                        <CustomDropdown
                            label="Type"
                            options={TYPES}
                            value={form.type}
                            renderProps="label"
                            returnProps="value"
                            onChange={(v) => set('type', v)}
                            className="w-full items-start!"
                        />
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <CustomSelection label="Active" checked={form.is_active} onChange={(v) => set('is_active', v)} indicatorPosition="left" className="text-left" />
                        </div>
                    </div>
                )}
            </CustomModal>

            <CustomModal isOpen={!!toDelete} onClose={() => setToDelete(null)} title="Remove holiday?" size="md">
                <div className="p-2 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-rose-100 bg-rose-50 text-rose-500">
                        <ShieldAlert size={26} />
                    </div>
                    <p className="mb-6 text-sm text-slate-500">
                        Remove <span className="font-semibold text-slate-800">{toDelete?.name}</span> ({prettyDate(toDelete?.date)}) from the calendar?
                    </p>
                    <div className="flex gap-3 border-t border-slate-100 pt-4">
                        <CustomButton onClick={() => setToDelete(null)} className="flex-1 border border-slate-200 bg-white! text-slate-700! hover:bg-slate-100!">Cancel</CustomButton>
                        <CustomButton
                            variant="danger" icon={Trash} iconPosition="left" isLoading={isMutating}
                            onClick={async () => { try { await remove(toDelete.uuid); setToDelete(null); } catch { /* handled */ } }}
                            className="flex-1"
                        >
                            Remove
                        </CustomButton>
                    </div>
                </div>
            </CustomModal>
        </div>
    );
}

export default Holidays;
