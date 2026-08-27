import { useState } from 'react';
import { PlusIcon, Save, ShieldAlert, Trash, CalendarRange } from 'lucide-react';
import { CustomDataTable } from '../../components/CustomDataTable';
import CustomModal from '../../components/CustomModal';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import CustomDropdown from '../../components/CustomDropdown';
import CustomLabel from '../../components/CustomLabel';
import NotFound from '../../components/NotFound';
import { can } from '../../utils/permissionCheck';
import { usePayPeriods } from '../../hooks/usePayroll';
import { PAY_FREQUENCIES, PERIOD_SEQUENCES, PERIOD_STATUSES, fmtDate } from './payrollOptions';
import Pill from './Pill';

const BLANK = {
    name: '', period_start: '', period_end: '', pay_date: '',
    frequency: 'semi_monthly', sequence: 'first_cutoff', status: 'open', remarks: '',
};
const VIEW = 'run-payroll:view';

function PayPeriods() {
    const { items, isLoading, error, create, update, remove, isMutating } = usePayPeriods();
    const [form, setForm] = useState(null);
    const [toDelete, setToDelete] = useState(null);
    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const submit = async () => {
        try {
            if (form.uuid) await update({ uuid: form.uuid, payload: form });
            else await create(form);
            setForm(null);
        } catch { /* handled */ }
    };

    const columns = [
        {
            header: 'Period',
            render: (r) => (
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-600">
                        <CalendarRange size={16} />
                    </div>
                    <div>
                        <div className="font-semibold text-slate-900">{r.name}</div>
                        <div className="text-xs text-slate-400">{fmtDate(r.period_start)} – {fmtDate(r.period_end)}</div>
                    </div>
                </div>
            ),
        },
        { header: 'Pay date', render: (r) => fmtDate(r.pay_date) },
        { header: 'Frequency', render: (r) => <span className="text-sm capitalize text-slate-600">{String(r.frequency).replace(/_/g, ' ')}</span> },
        { header: 'Sequence', render: (r) => <span className="text-sm capitalize text-slate-600">{String(r.sequence).replace(/_/g, ' ')}</span> },
        { header: 'Status', render: (r) => <Pill value={r.status} /> },
    ];

    const drawer = (row, close) => (
        <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-lg font-bold text-slate-900">{row.name}</p>
                <p className="text-xs text-slate-500">{fmtDate(row.period_start)} – {fmtDate(row.period_end)} · pays {fmtDate(row.pay_date)}</p>
                <div className="mt-2"><Pill value={row.status} /></div>
                {row.remarks && <p className="mt-3 text-sm text-slate-600">{row.remarks}</p>}
            </div>
            <div className="flex gap-2">
                {can('run-payroll:edit') && (
                    <CustomButton onClick={() => { close(); setForm({ ...BLANK, ...row }); }}
                        className="flex-1 border border-slate-200 bg-white! text-blue-700! hover:bg-blue-50!">Edit</CustomButton>
                )}
                {can('run-payroll:delete') && (
                    <CustomButton onClick={() => { close(); setToDelete(row); }}
                        className="flex-1 border border-rose-200 bg-rose-50! text-rose-600! hover:bg-rose-100!">Archive</CustomButton>
                )}
            </div>
        </div>
    );

    if (!can(VIEW)) return <NotFound />;

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="border-b border-slate-100 pb-4">
                <CustomLabel variant="h2" addedClass="font-bold text-slate-700!" description="Payroll cutoff calendar. Runs are created against a period.">
                    Pay Periods
                </CustomLabel>
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
                searchPlaceholder="Search periods..."
                renderDrawerContent={drawer}
                actionButton={can('run-payroll:create') && (
                    <CustomButton onClick={() => setForm({ ...BLANK })} icon={PlusIcon} iconPosition="left"
                        className="flex items-center gap-2 bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700">Add Period</CustomButton>
                )}
            />

            <CustomModal
                isOpen={!!form}
                onClose={() => setForm(null)}
                title={form?.uuid ? 'Edit Pay Period' : 'New Pay Period'}
                size="lg"
                showCloseButton
                hasRequiredFields
                footer={(
                    <div className="flex justify-center border-t border-slate-100 pt-4">
                        <CustomButton onClick={submit} icon={Save} iconPosition="left" isLoading={isMutating} disabled={isMutating}
                            className="bg-slate-800 px-5 py-2.5 text-sm hover:bg-slate-700">
                            {form?.uuid ? 'Save Changes' : 'Create Period'}
                        </CustomButton>
                    </div>
                )}
            >
                {form && (
                    <div className="space-y-4 px-1">
                        <CustomInput label="Name" isRequired value={form.name} placeholder="Aug 1–15, 2026"
                            onChange={(e) => set('name', e.target.value)} />
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <CustomInput label="Period start" isRequired type="date" value={form.period_start}
                                onChange={(e) => set('period_start', e.target.value)} />
                            <CustomInput label="Period end" isRequired type="date" value={form.period_end}
                                onChange={(e) => set('period_end', e.target.value)} />
                            <CustomInput label="Pay date" isRequired type="date" value={form.pay_date}
                                onChange={(e) => set('pay_date', e.target.value)} />
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <CustomDropdown label="Frequency" options={PAY_FREQUENCIES} value={form.frequency}
                                renderProps="label" returnProps="value" onChange={(v) => set('frequency', v)} className="w-full items-start!" />
                            <CustomDropdown label="Sequence" options={PERIOD_SEQUENCES} value={form.sequence}
                                renderProps="label" returnProps="value" onChange={(v) => set('sequence', v)} className="w-full items-start!" />
                            <CustomDropdown label="Status" options={PERIOD_STATUSES} value={form.status}
                                renderProps="label" returnProps="value" onChange={(v) => set('status', v)} className="w-full items-start!" />
                        </div>
                        <CustomInput label="Remarks" value={form.remarks} onChange={(e) => set('remarks', e.target.value)} />
                    </div>
                )}
            </CustomModal>

            <CustomModal isOpen={!!toDelete} onClose={() => setToDelete(null)} title="Archive period?" size="md">
                <div className="p-2 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-rose-100 bg-rose-50 text-rose-500">
                        <ShieldAlert size={26} />
                    </div>
                    <p className="mb-6 text-sm text-slate-500">
                        Archive <span className="font-semibold text-slate-800">{toDelete?.name}</span>? Only possible if it has no active runs.
                    </p>
                    <div className="flex gap-3 border-t border-slate-100 pt-4">
                        <CustomButton onClick={() => setToDelete(null)} className="flex-1 border border-slate-200 bg-white! text-slate-700! hover:bg-slate-100!">Cancel</CustomButton>
                        <CustomButton variant="danger" icon={Trash} iconPosition="left" isLoading={isMutating}
                            onClick={async () => { try { await remove(toDelete.uuid); setToDelete(null); } catch { /* handled */ } }}
                            className="flex-1">Archive</CustomButton>
                    </div>
                </div>
            </CustomModal>
        </div>
    );
}

export default PayPeriods;
