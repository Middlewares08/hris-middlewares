import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, Save, ShieldAlert, Play } from 'lucide-react';
import { CustomDataTable } from '../../components/CustomDataTable';
import CustomModal from '../../components/CustomModal';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import CustomDropdown from '../../components/CustomDropdown';
import CustomLabel from '../../components/CustomLabel';
import NotFound from '../../components/NotFound';
import { can } from '../../utils/permissionCheck';
import { usePayrollRuns, usePayPeriods } from '../../hooks/usePayroll';
import { RUN_TYPES, peso, fmtDate } from './payrollOptions';
import Pill from './Pill';

const VIEW = 'run-payroll:view';

function PayrollRuns() {
    const navigate = useNavigate();
    const { items, isLoading, error, create, isMutating } = usePayrollRuns();
    const { items: periods } = usePayPeriods();
    const [form, setForm] = useState(null);
    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const periodOptions = (periods || [])
        .filter((p) => p.status !== 'closed')
        .map((p) => ({ id: p.id, value: p.id, label: `${p.name} (${fmtDate(p.period_start)}–${fmtDate(p.period_end)})` }));

    const submit = async () => {
        try {
            const res = await create({
                pay_period_id: Number(form.pay_period_id),
                run_type: form.run_type,
                notes: form.notes || undefined,
            });
            setForm(null);
            if (res?.data?.uuid) navigate(`/dashboard/payroll/runs/${res.data.uuid}`);
        } catch { /* handled */ }
    };

    const columns = [
        {
            header: 'Run',
            render: (r) => (
                <div>
                    <div className="font-semibold text-slate-900">{r.period?.name || `Period #${r.pay_period_id}`}</div>
                    <div className="text-xs text-slate-400 capitalize">{String(r.run_type).replace(/_/g, ' ')} · run #{r.run_number}</div>
                </div>
            ),
        },
        { header: 'Status', render: (r) => <Pill value={r.status} /> },
        { header: 'Employees', render: (r) => r.employee_count ?? 0 },
        { header: 'Net total', render: (r) => <span className="font-medium text-slate-700">{peso(r.total_net)}</span> },
        { header: 'Employer cost', render: (r) => peso(r.total_employer_cost) },
        { header: 'Created', render: (r) => fmtDate(r.created_at) },
    ];

    if (!can(VIEW)) return <NotFound />;

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="border-b border-slate-100 pb-4">
                <CustomLabel variant="h2" addedClass="font-bold text-slate-700!" description="Create, calculate, approve and release payroll runs.">
                    Payroll Runs
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
                searchPlaceholder="Search runs..."
                onRowClick={(r) => navigate(`/dashboard/payroll/runs/${r.uuid}`)}
                renderDrawerContent={(r, close) => (
                    <div className="mt-4 space-y-4">
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                            <p className="text-lg font-bold text-slate-900">{r.period?.name}</p>
                            <p className="text-xs capitalize text-slate-500">{String(r.run_type).replace(/_/g, ' ')} · run #{r.run_number}</p>
                            <div className="mt-2"><Pill value={r.status} /></div>
                            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                <div><dt className="text-xs text-slate-400">Gross</dt><dd>{peso(r.total_gross)}</dd></div>
                                <div><dt className="text-xs text-slate-400">Deductions</dt><dd>{peso(r.total_deductions)}</dd></div>
                                <div><dt className="text-xs text-slate-400">Net</dt><dd className="font-semibold">{peso(r.total_net)}</dd></div>
                                <div><dt className="text-xs text-slate-400">Employer cost</dt><dd>{peso(r.total_employer_cost)}</dd></div>
                            </dl>
                        </div>
                        <CustomButton onClick={() => { close(); navigate(`/dashboard/payroll/runs/${r.uuid}`); }} icon={Play} iconPosition="left"
                            className="bg-slate-800 hover:bg-slate-700">Open run</CustomButton>
                    </div>
                )}
                actionButton={can('run-payroll:create') && (
                    <CustomButton onClick={() => setForm({ pay_period_id: '', run_type: 'regular', notes: '' })} icon={PlusIcon} iconPosition="left"
                        className="flex items-center gap-2 bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700">New Run</CustomButton>
                )}
            />

            <CustomModal
                isOpen={!!form}
                onClose={() => setForm(null)}
                title="New Payroll Run"
                size="md"
                showCloseButton
                hasRequiredFields
                footer={(
                    <div className="flex justify-center border-t border-slate-100 pt-4">
                        <CustomButton onClick={submit} icon={Save} iconPosition="left" isLoading={isMutating}
                            disabled={isMutating || !form?.pay_period_id}
                            className="bg-slate-800 px-5 py-2.5 text-sm hover:bg-slate-700">Create Run</CustomButton>
                    </div>
                )}
            >
                {form && (
                    <div className="space-y-4 px-1">
                        <CustomDropdown label="Pay period" isRequired options={periodOptions} value={form.pay_period_id}
                            renderProps="label" returnProps="value" placeholder="Choose a period..."
                            onChange={(v) => set('pay_period_id', v)} className="w-full items-start!" />
                        <CustomDropdown label="Run type" options={RUN_TYPES} value={form.run_type}
                            renderProps="label" returnProps="value" onChange={(v) => set('run_type', v)} className="w-full items-start!" />
                        <CustomInput label="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
                        <p className="text-xs text-slate-400">A run starts as a draft. You calculate payslips on the next screen.</p>
                    </div>
                )}
            </CustomModal>
        </div>
    );
}

export default PayrollRuns;
