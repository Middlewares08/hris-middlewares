import { useState } from 'react';
import { PlusIcon, Save, ShieldAlert, Trash, Coins } from 'lucide-react';
import { CustomDataTable } from '../../components/CustomDataTable';
import CustomModal from '../../components/CustomModal';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import CustomDropdown from '../../components/CustomDropdown';
import CustomLabel from '../../components/CustomLabel';
import NotFound from '../../components/NotFound';
import { can } from '../../utils/permissionCheck';
import { usePayComponents } from '../../hooks/usePayroll';
import { COMPONENT_TYPES, CALCULATION_TYPES } from './payrollOptions';
import Pill from './Pill';

const BLANK = {
    code: '', name: '', description: '', component_type: 'earning', calculation_type: 'manual',
    default_amount: '', default_rate: '', is_taxable: false, is_statutory: false,
    affects_thirteenth_month: false, is_active: true, display_order: '0',
};

// CustomInput calls value.replace(); every value it receives must be a string.
const s = (v) => (v === null || v === undefined ? '' : String(v));

const toForm = (row) => ({
    ...BLANK,
    ...row,
    description: s(row.description),
    default_amount: s(row.default_amount),
    default_rate: s(row.default_rate),
    display_order: s(row.display_order ?? 0),
});

const VIEW = 'payroll-and-compensation:view';

const Check = ({ label, checked, onChange }) => (
    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
        {label}
    </label>
);

function PayComponents() {
    const { items, isLoading, error, create, update, remove, isMutating } = usePayComponents();
    const [form, setForm] = useState(null);        // null = closed; object = create/edit
    const [toDelete, setToDelete] = useState(null);

    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const submit = async () => {
        const payload = {
            ...form,
            default_amount: form.default_amount === '' ? null : Number(form.default_amount),
            default_rate: form.default_rate === '' ? null : Number(form.default_rate),
            display_order: Number(form.display_order) || 0,
        };
        try {
            if (form.uuid) await update({ uuid: form.uuid, payload });
            else await create(payload);
            setForm(null);
        } catch { /* toast handled in hook */ }
    };

    const columns = [
        {
            header: 'Component',
            render: (r) => (
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-600">
                        <Coins size={16} />
                    </div>
                    <div>
                        <div className="font-semibold text-slate-900">{r.name}</div>
                        <div className="font-mono text-xs text-slate-400">{r.code}</div>
                    </div>
                </div>
            ),
        },
        { header: 'Type', render: (r) => <Pill value={r.component_type} /> },
        { header: 'Calculation', render: (r) => <span className="text-sm capitalize text-slate-600">{String(r.calculation_type).replace(/_/g, ' ')}</span> },
        { header: 'Taxable', render: (r) => (r.is_taxable ? 'Yes' : 'No') },
        { header: 'Active', render: (r) => (r.is_active ? <Pill value="applied" /> : <Pill value="cancelled" />) },
        { header: 'Order', render: (r) => r.display_order },
    ];

    const drawer = (row, close) => (
        <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-lg font-bold text-slate-900">{row.name}</p>
                <p className="font-mono text-xs text-slate-500">{row.code}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                    <Pill value={row.component_type} />
                    {row.is_statutory && <Pill value="approved" />}
                    {row.is_system && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">system</span>}
                </div>
                {row.description && <p className="mt-3 text-sm text-slate-600">{row.description}</p>}
            </div>
            <div className="flex gap-2">
                {can('payroll-and-compensation:edit') && (
                    <CustomButton onClick={() => { close(); setForm(toForm(row)); }}
                        variant="primary" className="flex-1 bg-white! text-blue-700! border border-slate-200 hover:bg-blue-50!">Edit</CustomButton>
                )}
                {can('payroll-and-compensation:delete') && !row.is_system && (
                    <CustomButton onClick={() => { close(); setToDelete(row); }}
                        variant="primary" className="flex-1 bg-rose-50! text-rose-600! border border-rose-200 hover:bg-rose-100!">Archive</CustomButton>
                )}
            </div>
        </div>
    );

    if (!can(VIEW)) return <NotFound />;

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="border-b border-slate-100 pb-4">
                <CustomLabel variant="h2" addedClass="font-bold text-slate-700!" description="Earning, deduction and employer-contribution types used across payroll runs.">
                    Pay Components
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
                searchPlaceholder="Search components..."
                renderDrawerContent={drawer}
                actionButton={can('payroll-and-compensation:create') && (
                    <CustomButton onClick={() => setForm({ ...BLANK })} icon={PlusIcon} iconPosition="left"
                        className="flex items-center gap-2 bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700">Add Component</CustomButton>
                )}
            />

            <CustomModal
                isOpen={!!form}
                onClose={() => setForm(null)}
                title={form?.uuid ? 'Edit Pay Component' : 'New Pay Component'}
                size="lg"
                showCloseButton
                hasRequiredFields
                footer={(
                    <div className="flex justify-center border-t border-slate-100 pt-4">
                        <CustomButton onClick={submit} icon={Save} iconPosition="left" isLoading={isMutating} disabled={isMutating}
                            className="bg-slate-800 px-5 py-2.5 text-sm hover:bg-slate-700">
                            {form?.uuid ? 'Save Changes' : 'Create Component'}
                        </CustomButton>
                    </div>
                )}
            >
                {form && (
                    <div className="max-h-[60vh] space-y-4 overflow-y-auto px-1">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <CustomInput label="Code" isRequired value={s(form.code)} disabled={form.is_system}
                                placeholder="ALLOW_TRANSPORT" inputClassName="font-mono"
                                onChange={(e) => set('code', e.target.value.toUpperCase())} />
                            <CustomInput label="Name" isRequired value={s(form.name)} placeholder="Transport Allowance"
                                onChange={(e) => set('name', e.target.value)} />
                        </div>
                        <CustomInput label="Description" value={s(form.description)} onChange={(e) => set('description', e.target.value)} />
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <CustomDropdown label="Type" isRequired options={COMPONENT_TYPES} value={form.component_type}
                                renderProps="label" returnProps="value" disabled={form.is_system}
                                onChange={(v) => set('component_type', v)} className="w-full items-start!" />
                            <CustomDropdown label="Calculation" options={CALCULATION_TYPES} value={form.calculation_type}
                                renderProps="label" returnProps="value" onChange={(v) => set('calculation_type', v)} className="w-full items-start!" />
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <CustomInput label="Default amount" type="number" value={s(form.default_amount)}
                                onChange={(e) => set('default_amount', e.target.value)} />
                            <CustomInput label="Default rate" type="number" value={s(form.default_rate)}
                                onChange={(e) => set('default_rate', e.target.value)} />
                            <CustomInput label="Display order" type="number" value={s(form.display_order)}
                                onChange={(e) => set('display_order', e.target.value)} />
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <Check label="Taxable" checked={form.is_taxable} onChange={(v) => set('is_taxable', v)} />
                            <Check label="Statutory" checked={form.is_statutory} onChange={(v) => set('is_statutory', v)} />
                            <Check label="Counts toward 13th month" checked={form.affects_thirteenth_month} onChange={(v) => set('affects_thirteenth_month', v)} />
                            <Check label="Active" checked={form.is_active} onChange={(v) => set('is_active', v)} />
                        </div>
                    </div>
                )}
            </CustomModal>

            <CustomModal isOpen={!!toDelete} onClose={() => setToDelete(null)} title="Archive component?" size="md">
                <div className="p-2 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-rose-100 bg-rose-50 text-rose-500">
                        <ShieldAlert size={26} />
                    </div>
                    <p className="mb-6 text-sm text-slate-500">
                        Archive <span className="font-mono font-semibold text-slate-800">{toDelete?.code}</span>? It will stop appearing in new payroll runs.
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

export default PayComponents;
