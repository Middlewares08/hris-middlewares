import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, Save, ShieldAlert, Trash, Briefcase, ArrowRight } from 'lucide-react';
import { CustomDataTable } from '../../components/CustomDataTable';
import CustomModal from '../../components/CustomModal';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import CustomDropdown from '../../components/CustomDropdown';
import CustomLabel from '../../components/CustomLabel';
import CustomForm from '../../components/CustomForm';
import NotFound from '../../components/NotFound';
import { can } from '../../utils/permissionCheck';
import { useEwtPayees } from '../../hooks/usePayroll';
import { PAYEE_TYPES } from './payrollOptions';
import { ewtPayeeValidationSchema } from '../../validation/ewt-payee-validation';
import Pill from './Pill';
import CustomSelection from '../../components/CustomSelection';

const BLANK = {
    payee_type: 'individual', registered_name: '', trade_name: '', tin: '', tin_branch: '0000',
    address_line1: '', city: '', province: '', zip_code: '', contact_email: '', contact_phone: '',
    is_active: true,
};

// CustomInput calls value.replace(); every value it receives must be a string.
const s = (v) => (v === null || v === undefined ? '' : String(v));

const toForm = (row) => ({
    ...BLANK,
    ...row,
    trade_name: s(row.trade_name),
    address_line1: s(row.address_line1),
    city: s(row.city),
    province: s(row.province),
    zip_code: s(row.zip_code),
    contact_email: s(row.contact_email),
    contact_phone: s(row.contact_phone),
});

const VIEW = 'ewt-payees:view';

function EwtPayees() {
    const navigate = useNavigate();
    const { items, isLoading, error, create, update, remove, isMutating } = useEwtPayees();
    const [form, setForm] = useState(null); // null = closed; object = create/edit
    const [toDelete, setToDelete] = useState(null);
    const formikRef = useRef(null);

    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const submit = async () => {
        try {
            if (form.uuid) await update({ uuid: form.uuid, payload: form });
            else await create(form);
            setForm(null);
        } catch { /* toast handled in hook */ }
    };

    const columns = [
        {
            header: 'Payee',
            render: (r) => (
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-600">
                        <Briefcase size={16} />
                    </div>
                    <div>
                        <div className="font-semibold text-slate-900">{r.registered_name}</div>
                        {r.trade_name && <div className="text-xs text-slate-400">{r.trade_name}</div>}
                    </div>
                </div>
            ),
        },
        { header: 'Type', render: (r) => <span className="text-sm capitalize text-slate-600">{String(r.payee_type).replace(/_/g, '-')}</span> },
        { header: 'TIN', render: (r) => <span className="font-mono text-xs">{r.tin}-{r.tin_branch}</span> },
        { header: 'Active', render: (r) => (r.is_active ? <Pill value="applied" /> : <Pill value="cancelled" />) },
    ];

    const drawer = (row, close) => (
        <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-lg font-bold text-slate-900">{row.registered_name}</p>
                <p className="font-mono text-xs text-slate-500">TIN {row.tin}-{row.tin_branch}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-600">{String(row.payee_type).replace(/_/g, '-')}</span>
                </div>
            </div>
            <div className="flex gap-2">
                <CustomButton
                    children="View Payments"
                    icon={ArrowRight}
                    iconPosition="left"
                    onClick={() => { close(); navigate(`/dashboard/payroll/ewt-payees/${row.uuid}`); }}
                    className="flex-1 py-2 border border-slate-200 rounded text-xs bg-white! text-slate-700! hover:bg-slate-50!"
                />
                {can('ewt-payees:edit') && (
                    <CustomButton
                        children="Edit"
                        onClick={() => { close(); setForm(toForm(row)); }}
                        className="flex-1 py-2 border border-slate-200 rounded text-xs bg-white! text-blue-700! hover:bg-blue-50!"
                    />
                )}
                {can('ewt-payees:delete') && (
                    <CustomButton
                        children="Archive"
                        onClick={() => { close(); setToDelete(row); }}
                        className="flex-1 py-2 border border-rose-200 rounded text-xs bg-rose-50! text-rose-600! hover:bg-rose-100!"
                    />
                )}
            </div>
        </div>
    );

    if (!can(VIEW)) return <NotFound />;

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="border-b border-slate-100 pb-4">
                <CustomLabel
                    variant="h2"
                    addedClass="font-bold text-slate-700!"
                    description="Contractors, professionals, talents and suppliers subject to expanded withholding tax — feeds BIR Form 2307."
                    children="EWT Payees"
                    descriptionClass="text-xs"
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
                searchPlaceholder="Search payees..."
                renderDrawerContent={drawer}
                onRowClick={(r) => navigate(`/dashboard/payroll/ewt-payees/${r.uuid}`)}
                actionButton={can('ewt-payees:create') && (
                    <CustomButton
                        children="Add Payee"
                        onClick={() => setForm({ ...BLANK })}
                        icon={PlusIcon}
                        iconPosition="left"
                        className="flex py-2 items-center gap-2 hover:cursor-pointer px-4 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors shadow-xs"
                    />
                )}
            />

            <CustomModal
                isOpen={!!form}
                onClose={() => setForm(null)}
                title={form?.uuid ? 'Edit Payee' : 'New Payee'}
                size="lg"
                showCloseButton
                hasRequiredFields
                footer={(
                    <div className="flex justify-center border-t border-slate-100 pt-4">
                        <CustomButton
                            children={form?.uuid ? 'Save Changes' : 'Create Payee'}
                            onClick={() => formikRef?.current?.submitForm()}
                            icon={Save}
                            iconPosition="left"
                            isLoading={isMutating}
                            disabled={isMutating}
                            className="flex py-2 items-center gap-2 hover:cursor-pointer px-4 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors shadow-xs"
                        />
                    </div>
                )}
            >
                {form && (
                    <CustomForm
                        formRef={formikRef}
                        initialValues={form}
                        validationSchema={ewtPayeeValidationSchema}
                        onSubmit={submit}
                        id="ewt-payee-form"
                        content={(errors, touched) => (
                            <div className="max-h-[60vh] space-y-4 scrollbar-y-visible overflow-y-auto px-1 pb-4">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <CustomDropdown
                                        label="Payee type"
                                        isRequired
                                        options={PAYEE_TYPES}
                                        value={form.payee_type}
                                        renderProps="label"
                                        returnProps="value"
                                        onChange={(v) => set('payee_type', v)}
                                        className="w-full items-start!"
                                        error={errors.payee_type && touched.payee_type}
                                        errorLabel={errors.payee_type}
                                    />
                                    <CustomSelection
                                        className="text-left"
                                        label="Active"
                                        checked={form.is_active}
                                        onChange={(v) => set('is_active', v)}
                                        indicatorPosition="left"
                                    />
                                </div>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <CustomInput
                                        label="Registered name"
                                        isRequired
                                        value={s(form.registered_name)}
                                        placeholder="e.g. Juan Dela Cruz / Acme Consulting Corp."
                                        onChange={(e) => set('registered_name', e.target.value)}
                                        error={errors.registered_name && touched.registered_name}
                                        errorLabel={errors.registered_name}
                                    />
                                    <CustomInput
                                        label="Trade name"
                                        value={s(form.trade_name)}
                                        onChange={(e) => set('trade_name', e.target.value)}
                                        error={errors.trade_name && touched.trade_name}
                                        errorLabel={errors.trade_name}
                                    />
                                </div>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <CustomInput
                                        label="TIN (9 digits, no dashes)"
                                        isRequired
                                        value={s(form.tin)}
                                        inputClassName="font-mono"
                                        placeholder="123456789"
                                        onChange={(e) => set('tin', e.target.value.replace(/\D/g, '').slice(0, 9))}
                                        error={errors.tin && touched.tin}
                                        errorLabel={errors.tin}
                                    />
                                    <CustomInput
                                        label="TIN branch code"
                                        value={s(form.tin_branch)}
                                        inputClassName="font-mono"
                                        placeholder="0000"
                                        onChange={(e) => set('tin_branch', e.target.value.replace(/\D/g, '').slice(0, 5))}
                                        error={errors.tin_branch && touched.tin_branch}
                                        errorLabel={errors.tin_branch}
                                    />
                                </div>
                                <CustomInput
                                    label="Address"
                                    value={s(form.address_line1)}
                                    onChange={(e) => set('address_line1', e.target.value)}
                                    error={errors.address_line1 && touched.address_line1}
                                    errorLabel={errors.address_line1}
                                />
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                    <CustomInput label="City" value={s(form.city)} onChange={(e) => set('city', e.target.value)} />
                                    <CustomInput label="Province" value={s(form.province)} onChange={(e) => set('province', e.target.value)} />
                                    <CustomInput label="Zip code" value={s(form.zip_code)} onChange={(e) => set('zip_code', e.target.value)} />
                                </div>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 border-t border-slate-100 pt-4">
                                    <CustomInput
                                        label="Contact email"
                                        value={s(form.contact_email)}
                                        onChange={(e) => set('contact_email', e.target.value)}
                                        error={errors.contact_email && touched.contact_email}
                                        errorLabel={errors.contact_email}
                                    />
                                    <CustomInput label="Contact phone" value={s(form.contact_phone)} onChange={(e) => set('contact_phone', e.target.value)} />
                                </div>
                            </div>
                        )}
                    />
                )}
            </CustomModal>

            <CustomModal isOpen={!!toDelete} onClose={() => setToDelete(null)} title="Archive payee?" size="md">
                <div className="p-2 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-rose-100 bg-rose-50 text-rose-500">
                        <ShieldAlert size={26} />
                    </div>
                    <p className="mb-6 text-sm text-slate-500">
                        Archive <span className="font-semibold text-slate-800">{toDelete?.registered_name}</span>? Their payment history is kept for filed periods.
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

export default EwtPayees;
