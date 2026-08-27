import { useState } from 'react';
import { PlusIcon, Save, ShieldAlert, Trash, Banknote } from 'lucide-react';
import { CustomDataTable } from '../../components/CustomDataTable';
import CustomModal from '../../components/CustomModal';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import CustomDropdown from '../../components/CustomDropdown';
import CustomLabel from '../../components/CustomLabel';
import NotFound from '../../components/NotFound';
import { can } from '../../utils/permissionCheck';
import { useEmployees } from '../../hooks/useEmployee';
import { useCompensations } from '../../hooks/usePayroll';
import { RATE_TYPES, PAY_FREQUENCIES, PAYMENT_METHODS, peso, fmtDate } from './payrollOptions';
import Pill from './Pill';

const BLANK = {
    employee_id: '', pay_rate: '', rate_type: 'monthly', working_days_per_month: '22', working_hours_per_day: '8',
    pay_frequency: 'semi_monthly', tax_status: '', is_minimum_wage_earner: false, is_tax_exempt: false,
    payment_method: 'bank_transfer', bank_name: '', bank_account_name: '', bank_account_number: '',
    effective_date: '', end_date: '', is_active: true, remarks: '',
};

// CustomInput calls value.replace(); every value it receives must be a string.
const s = (v) => (v === null || v === undefined ? '' : String(v));

// Normalise a compensation row into editable (string) form state.
const toForm = (row) => ({
    ...BLANK,
    ...row,
    pay_rate: s(row.pay_rate),
    working_days_per_month: s(row.working_days_per_month ?? 22),
    working_hours_per_day: s(row.working_hours_per_day ?? 8),
    tax_status: s(row.tax_status),
    effective_date: s(row.effective_date).slice(0, 10),
    end_date: s(row.end_date).slice(0, 10),
    bank_name: s(row.bank_name),
    bank_account_name: s(row.bank_account_name),
    bank_account_number: '',
    remarks: s(row.remarks),
});
const VIEW = 'payroll-and-compensation:view';

function EmployeeCompensation() {
    const { items, isLoading, error, create, update, remove, isMutating } = useCompensations();
    const { employees } = useEmployees({ page: 1, limit: 200, search: '' });
    const [form, setForm] = useState(null);
    const [toDelete, setToDelete] = useState(null);
    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const empOptions = (employees || []).map((e) => ({ id: e.id, value: e.id, label: `${e.first_name} ${e.last_name}` }));

    const submit = async () => {
        const payload = {
            ...form,
            employee_id: Number(form.employee_id),
            pay_rate: Number(form.pay_rate),
            working_days_per_month: Number(form.working_days_per_month) || 22,
            working_hours_per_day: Number(form.working_hours_per_day) || 8,
            tax_status: form.tax_status || null,
            end_date: form.end_date || null,
            bank_account_number: form.bank_account_number || null,
        };
        try {
            if (form.uuid) await update({ uuid: form.uuid, payload });
            else await create(payload);
            setForm(null);
        } catch { /* handled */ }
    };

    const columns = [
        {
            header: 'Employee',
            render: (r) => (
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-600">
                        <Banknote size={16} />
                    </div>
                    <div>
                        <div className="font-semibold text-slate-900">
                            {r.employee ? `${r.employee.first_name} ${r.employee.last_name}` : `Employee #${r.employee_id}`}
                        </div>
                        <div className="text-xs text-slate-400">eff. {fmtDate(r.effective_date)}</div>
                    </div>
                </div>
            ),
        },
        { header: 'Rate', render: (r) => <span className="font-medium text-slate-700">{peso(r.pay_rate)}</span> },
        { header: 'Type', render: (r) => <span className="text-sm capitalize text-slate-600">{String(r.rate_type).replace(/_/g, ' ')}</span> },
        { header: 'Monthly equiv.', render: (r) => peso(r.monthly_equivalent) },
        { header: 'Frequency', render: (r) => <span className="text-sm capitalize text-slate-600">{String(r.pay_frequency).replace(/_/g, ' ')}</span> },
        { header: 'Active', render: (r) => (r.is_active ? <Pill value="applied" /> : <Pill value="cancelled" />) },
    ];

    const drawer = (row, close) => (
        <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-lg font-bold text-slate-900">
                    {row.employee ? `${row.employee.first_name} ${row.employee.last_name}` : `Employee #${row.employee_id}`}
                </p>
                <p className="text-xs text-slate-500">{peso(row.pay_rate)} / {String(row.rate_type).replace(/_/g, ' ')} · monthly {peso(row.monthly_equivalent)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                    {row.is_active ? <Pill value="applied" /> : <Pill value="cancelled" />}
                    {row.is_minimum_wage_earner && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">MWE</span>}
                    {row.bank_account_last4 && <span className="text-[11px] text-slate-400">acct •••• {row.bank_account_last4.replace(/•/g, '')}</span>}
                </div>
            </div>
            <div className="flex gap-2">
                {can('payroll-and-compensation:edit') && (
                    <CustomButton onClick={() => { close(); setForm(toForm(row)); }}
                        className="flex-1 border border-slate-200 bg-white! text-blue-700! hover:bg-blue-50!">Edit</CustomButton>
                )}
                {can('payroll-and-compensation:delete') && (
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
                <CustomLabel variant="h2" addedClass="font-bold text-slate-700!" description="Effective-dated base pay per employee. Creating a new record supersedes the current one.">
                    Employee Compensation
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
                searchPlaceholder="Search employee..."
                renderDrawerContent={drawer}
                actionButton={can('payroll-and-compensation:create') && (
                    <CustomButton onClick={() => setForm({ ...BLANK })} icon={PlusIcon} iconPosition="left"
                        className="flex items-center gap-2 bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700">Add Compensation</CustomButton>
                )}
            />

            <CustomModal
                isOpen={!!form}
                onClose={() => setForm(null)}
                title={form?.uuid ? 'Edit Compensation' : 'New Compensation'}
                size="lg"
                showCloseButton
                hasRequiredFields
                footer={(
                    <div className="flex justify-center border-t border-slate-100 pt-4">
                        <CustomButton onClick={submit} icon={Save} iconPosition="left" isLoading={isMutating}
                            disabled={isMutating || !form?.employee_id || !form?.pay_rate || !form?.effective_date}
                            className="bg-slate-800 px-5 py-2.5 text-sm hover:bg-slate-700">
                            {form?.uuid ? 'Save Changes' : 'Create'}
                        </CustomButton>
                    </div>
                )}
            >
                {form && (
                    <div className="max-h-[62vh] space-y-4 overflow-y-auto px-1">
                        <CustomDropdown label="Employee" isRequired options={empOptions} value={form.employee_id}
                            renderProps="label" returnProps="value" placeholder="Choose employee..." disabled={!!form.uuid}
                            onChange={(v) => set('employee_id', v)} className="w-full items-start!" />
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <CustomInput label="Pay rate" isRequired type="number" value={s(form.pay_rate)}
                                onChange={(e) => set('pay_rate', e.target.value)} />
                            <CustomDropdown label="Rate type" options={RATE_TYPES} value={form.rate_type}
                                renderProps="label" returnProps="value" onChange={(v) => set('rate_type', v)} className="w-full items-start!" />
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <CustomInput label="Work days / mo" type="number" value={s(form.working_days_per_month)}
                                onChange={(e) => set('working_days_per_month', e.target.value)} />
                            <CustomInput label="Work hrs / day" type="number" value={s(form.working_hours_per_day)}
                                onChange={(e) => set('working_hours_per_day', e.target.value)} />
                            <CustomDropdown label="Frequency" options={PAY_FREQUENCIES} value={form.pay_frequency}
                                renderProps="label" returnProps="value" onChange={(v) => set('pay_frequency', v)} className="w-full items-start!" />
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <CustomInput label="Effective date" isRequired type="date" value={s(form.effective_date)}
                                onChange={(e) => set('effective_date', e.target.value)} />
                            <CustomInput label="End date" type="date" value={s(form.end_date)}
                                onChange={(e) => set('end_date', e.target.value)} />
                            <CustomInput label="Tax status" value={s(form.tax_status)} placeholder="S / ME / S1"
                                onChange={(e) => set('tax_status', e.target.value)} />
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" checked={form.is_minimum_wage_earner} className="h-4 w-4 rounded border-slate-300"
                                    onChange={(e) => set('is_minimum_wage_earner', e.target.checked)} />
                                Minimum wage earner
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" checked={form.is_tax_exempt} className="h-4 w-4 rounded border-slate-300"
                                    onChange={(e) => set('is_tax_exempt', e.target.checked)} />
                                Tax exempt
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" checked={form.is_active} className="h-4 w-4 rounded border-slate-300"
                                    onChange={(e) => set('is_active', e.target.checked)} />
                                Active
                            </label>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <CustomDropdown label="Payment method" options={PAYMENT_METHODS} value={form.payment_method}
                                renderProps="label" returnProps="value" onChange={(v) => set('payment_method', v)} className="w-full items-start!" />
                            <CustomInput label="Bank name" value={s(form.bank_name)} onChange={(e) => set('bank_name', e.target.value)} />
                            <CustomInput label="Account name" value={s(form.bank_account_name)} onChange={(e) => set('bank_account_name', e.target.value)} />
                            <CustomInput label="Account number" value={s(form.bank_account_number)}
                                placeholder={form.uuid ? 'Leave blank to keep current' : ''}
                                onChange={(e) => set('bank_account_number', e.target.value)} />
                        </div>
                        <CustomInput label="Remarks" value={s(form.remarks)} onChange={(e) => set('remarks', e.target.value)} />
                    </div>
                )}
            </CustomModal>

            <CustomModal isOpen={!!toDelete} onClose={() => setToDelete(null)} title="Archive compensation?" size="md">
                <div className="p-2 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-rose-100 bg-rose-50 text-rose-500">
                        <ShieldAlert size={26} />
                    </div>
                    <p className="mb-6 text-sm text-slate-500">Archive this compensation record?</p>
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

export default EmployeeCompensation;
