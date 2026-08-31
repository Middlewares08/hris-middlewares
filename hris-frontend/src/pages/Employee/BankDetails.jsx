import { useRef, useState } from 'react';
import { Banknote, Landmark, ShieldAlert } from 'lucide-react';
import CustomLabel from '../../components/CustomLabel';
import { CustomDataTable } from '../../components/CustomDataTable';
import { CustomAvatar } from '../../components/CustomAvatar';
import CustomButton from '../../components/CustomButton';
import CustomModal from '../../components/CustomModal';
import CustomForm from '../../components/CustomForm';
import CustomInput from '../../components/CustomInput';
import CustomDropdown from '../../components/CustomDropdown';
import NotFound from '../../components/NotFound';
import { can } from '../../utils/permissionCheck';
import { useEmployeeBankDetails } from '../../hooks/useBankDetails';
import { PAYMENT_METHODS, fmtDate } from '../Payroll/payrollOptions';
import { bankDetailValidationSchema } from '../../validation/bank-detail-validation';

const VIEW = 'payroll-and-compensation:view';
const EDIT = 'payroll-and-compensation:edit';

const PAYMENT_METHOD_LABELS = PAYMENT_METHODS.reduce((acc, o) => ({ ...acc, [o.value]: o.label }), {});
const s = (v) => (v === null || v === undefined ? '' : String(v));

function BankDetails() {
    const formRef = useRef(null);
    const [form, setForm] = useState(null);
    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const {
        employees,
        loading,
        error,
        currentPage,
        totalRecords,
        handleSearch,
        handlePageChange,
        handleUpsert,
    } = useEmployeeBankDetails();

    const openEdit = (row) => {
        setForm({
            employee_id: row.employee_id,
            payment_method: row.payment_method || 'bank_transfer',
            bank_name: s(row.bank_name),
            bank_account_name: s(row.bank_account_name),
            bank_account_number: '',
        });
    };

    const submit = async () => {
        try {
            await handleUpsert(form.employee_id, {
                payment_method: form.payment_method,
                bank_name: form.bank_name || null,
                bank_account_name: form.bank_account_name || null,
                bank_account_number: form.bank_account_number || undefined,
            });
            setForm(null);
        } catch { /* toast handled in the hook */ }
    };

    const columns = [
        {
            header: 'Employee',
            render: (row) => (
                <div className="flex items-center gap-3">
                    <CustomAvatar
                        src={row?.employee?.profile_url}
                        firstName={row?.employee?.first_name}
                        lastName={row?.employee?.last_name}
                        size="h-10 w-10 text-sm"
                    />
                    <div className="flex flex-col">
                        <span className="font-semibold text-gray-900">
                            {`${row?.employee?.first_name} ${row?.employee?.last_name}`}
                        </span>
                        <span className="text-xs text-gray-400">{row?.employee?.credentials?.email}</span>
                    </div>
                </div>
            ),
        },
        {
            header: 'Payment Method',
            render: (row) =>
                row?.payment_method ? (
                    <span className="text-sm capitalize text-slate-600">
                        {PAYMENT_METHOD_LABELS[row.payment_method] || row.payment_method}
                    </span>
                ) : (
                    <span className="inline-flex items-center font-mono text-xs text-slate-400">N/A</span>
                ),
        },
        {
            header: 'Bank',
            render: (row) =>
                row?.bank_name ? (
                    <span className="text-sm font-medium text-slate-700">{row.bank_name}</span>
                ) : (
                    <span className="inline-flex items-center font-mono text-xs text-slate-400">N/A</span>
                ),
        },
        {
            header: 'Account Name',
            render: (row) =>
                row?.bank_account_name ? (
                    <span className="text-sm text-slate-600">{row.bank_account_name}</span>
                ) : (
                    <span className="inline-flex items-center font-mono text-xs text-slate-400">N/A</span>
                ),
        },
        {
            header: 'Account No.',
            render: (row) =>
                row?.bank_account_last4 ? (
                    <span className="font-mono text-xs font-bold tracking-wider text-slate-700">
                        {row.bank_account_last4}
                    </span>
                ) : (
                    <span className="inline-flex items-center font-mono text-xs text-slate-400">
                        {row?.has_pay_profile ? 'Not set' : 'No pay profile'}
                    </span>
                ),
        },
    ];

    const renderDrawerContent = (row, closeDrawer) => (
        <div className="space-y-6 pt-2 text-left">
            <div className="flex items-center gap-4">
                <CustomAvatar
                    src={row?.employee?.profile_url}
                    firstName={row?.employee?.first_name}
                    lastName={row?.employee?.last_name}
                    size="h-14 w-14 text-lg"
                />
                <CustomLabel
                    variant="h4"
                    children={`${row?.employee?.first_name} ${row?.employee?.last_name}`}
                    addedClass="font-bold text-slate-700!"
                    descriptionClass="text-sm text-slate-500"
                    description={row?.employee?.position?.name || 'No Position Assigned'}
                />
            </div>

            <hr className="border-gray-100" />

            {!row?.has_pay_profile ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                    <span>
                        This employee has no active compensation record. Add one under
                        {' '}
                        <span className="font-semibold">Employee Compensation</span> before setting bank details.
                    </span>
                </div>
            ) : (
                <div className="space-y-5 rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-700">
                    <span className="block py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-400">
                        Payroll Bank Account
                    </span>
                    <hr className="border-gray-200" />
                    {[
                        ['Payment Method', PAYMENT_METHOD_LABELS[row.payment_method] || row.payment_method || 'N/A'],
                        ['Bank', row.bank_name || 'N/A'],
                        ['Account Name', row.bank_account_name || 'N/A'],
                        ['Account Number', row.bank_account_last4 || 'Not set'],
                        ['Effective', fmtDate(row.effective_date)],
                    ].map(([label, value]) => (
                        <div key={label} className="flex w-full justify-between">
                            <CustomLabel children={label} addedClass="text-slate-700! text-sm" />
                            <CustomLabel children={value} addedClass="text-slate-700! font-semibold" />
                        </div>
                    ))}
                </div>
            )}

            {can(EDIT) && row?.has_pay_profile && (
                <div className="flex gap-2 border-t border-gray-100 pt-6">
                    <CustomButton
                        children="Update Bank Details"
                        onClick={() => { closeDrawer(); openEdit(row); }}
                        disabled={loading}
                        variant="primary"
                        className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                    />
                </div>
            )}
        </div>
    );

    if (!can(VIEW)) return <NotFound />;

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Landmark size={20} />
                </div>
                <CustomLabel
                    variant="h2"
                    children="Bank Details"
                    addedClass="font-bold text-slate-700!"
                    descriptionClass="text-sm text-slate-500"
                    description="Payroll bank account per employee. Stored on the active compensation record; account numbers are encrypted."
                />
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    <ShieldAlert size={16} /> {error}
                </div>
            )}

            <CustomDataTable
                data={employees}
                columns={columns}
                isLoading={loading}
                searchPlaceholder="Search by employee name..."
                isServerSide={true}
                totalRecords={totalRecords}
                currentPage={currentPage}
                recordsPerPage={10}
                onPageChange={handlePageChange}
                onSearch={handleSearch}
                renderDrawerContent={renderDrawerContent}
            />

            <CustomModal
                isOpen={!!form}
                onClose={() => setForm(null)}
                title="Update Bank Details"
                size="lg"
                showCloseButton
                hasRequiredFields
                footer={
                    <div className="flex justify-center border-t border-slate-100 pt-4">
                        <CustomButton
                            children="Save Changes"
                            onClick={() => formRef?.current?.submitForm()}
                            icon={Banknote}
                            iconPosition="left"
                            disabled={loading}
                            isLoading={loading}
                            variant="primary"
                            className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                        />
                    </div>
                }
            >
                {form && (
                    <CustomForm
                        formRef={formRef}
                        initialValues={form}
                        validationSchema={bankDetailValidationSchema}
                        onSubmit={submit}
                        id="bank-details-form"
                        content={(errors, touched) => (
                            <div className="space-y-4 px-1 pb-4">
                                <CustomDropdown
                                    label="Payment Method"
                                    options={PAYMENT_METHODS}
                                    value={form.payment_method}
                                    renderProps="label"
                                    returnProps="value"
                                    onChange={(v) => set('payment_method', v)}
                                    className="w-full items-start!"
                                    error={errors.payment_method && touched.payment_method}
                                    errorLabel={errors.payment_method}
                                />
                                <CustomInput
                                    label="Bank Name"
                                    value={s(form.bank_name)}
                                    placeholder="e.g. BDO, BPI, Metrobank"
                                    onChange={(e) => set('bank_name', e.target.value)}
                                    error={errors.bank_name && touched.bank_name}
                                    errorLabel={errors.bank_name}
                                />
                                <CustomInput
                                    label="Account Name"
                                    value={s(form.bank_account_name)}
                                    placeholder="Name on the account"
                                    onChange={(e) => set('bank_account_name', e.target.value)}
                                    error={errors.bank_account_name && touched.bank_account_name}
                                    errorLabel={errors.bank_account_name}
                                />
                                <CustomInput
                                    label="Account Number"
                                    value={s(form.bank_account_number)}
                                    placeholder="Leave blank to keep the current number"
                                    onChange={(e) => set('bank_account_number', e.target.value)}
                                    error={errors.bank_account_number && touched.bank_account_number}
                                    errorLabel={errors.bank_account_number}
                                />
                                <p className="text-[11px] leading-relaxed text-slate-400">
                                    The account number is encrypted at rest and only ever shown masked
                                    (••••1234). Type a new number to replace it.
                                </p>
                            </div>
                        )}
                    />
                )}
            </CustomModal>
        </div>
    );
}

export default BankDetails;
