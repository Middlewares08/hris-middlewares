import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, PlusIcon, Trash2, Receipt } from 'lucide-react';
import CustomModal from '../../components/CustomModal';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import CustomDropdown from '../../components/CustomDropdown';
import CustomForm from '../../components/CustomForm';
import Loading from '../../components/Loading';
import NotFound from '../../components/NotFound';
import { can } from '../../utils/permissionCheck';
import { useEwtPayee, useEwtPayments } from '../../hooks/usePayroll';
import { ATC_CODES } from '../../utils/constants';
import { peso, fmtDate } from './payrollOptions';
import { ewtPaymentValidationSchema } from '../../validation/ewt-payment-validation';

const VIEW = 'ewt-payees:view';
const EDIT = 'ewt-payees:edit';

const now = new Date();
const YEAR_OPTS = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]
    .map((y) => ({ id: y, value: y, label: String(y) }));
const QUARTER_OPTS = [
    { id: 1, value: 1, label: 'Q1 (Jan–Mar)' },
    { id: 2, value: 2, label: 'Q2 (Apr–Jun)' },
    { id: 3, value: 3, label: 'Q3 (Jul–Sep)' },
    { id: 4, value: 4, label: 'Q4 (Oct–Dec)' },
];

const BLANK_PAYMENT = {
    atc_code: '', income_payment_amount: '', tax_withheld_amount: '',
    payment_date: '', period_year: now.getFullYear(), period_quarter: Math.floor(now.getMonth() / 3) + 1,
    reference_no: '',
};

function StatCard({ label, value }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-400">{label}</p>
            <p className="mt-1 text-base font-medium text-slate-700">{value}</p>
        </div>
    );
}

function EwtPayeeDetail() {
    const { uuid } = useParams();
    const navigate = useNavigate();

    const { payee, isLoading, error } = useEwtPayee(uuid);
    const { payments, create: createPayment, remove: removePayment, isMutating: paymentBusy } = useEwtPayments(uuid);

    const [payForm, setPayForm] = useState(null);
    const payFormikRef = useRef(null);

    if (!can(VIEW)) return <NotFound />;
    if (isLoading) return <Loading size="lg" text="Loading payee" fullPage />;
    if (error || !payee) {
        return (
            <div className="mx-auto max-w-3xl p-8 text-center">
                <p className="text-slate-500">{error || 'Payee not found.'}</p>
                <CustomButton onClick={() => navigate('/dashboard/payroll/ewt-payees')} className="mt-4 w-auto! px-4">Back to payees</CustomButton>
            </div>
        );
    }

    const canEdit = can(EDIT);
    const totalIncome = payments.reduce((t, p) => t + Number(p.income_payment_amount || 0), 0);
    const totalWithheld = payments.reduce((t, p) => t + Number(p.tax_withheld_amount || 0), 0);

    const submitPayment = async () => {
        try {
            await createPayment({
                atc_code: payForm.atc_code,
                income_payment_amount: Number(payForm.income_payment_amount),
                tax_withheld_amount: Number(payForm.tax_withheld_amount),
                payment_date: payForm.payment_date,
                period_year: Number(payForm.period_year),
                period_quarter: Number(payForm.period_quarter),
                reference_no: payForm.reference_no || null,
            });
            setPayForm(null);
        } catch { /* handled */ }
    };

    return (
        <div className="mx-auto max-w-5xl space-y-6 text-left">
            <button onClick={() => navigate('/dashboard/payroll/ewt-payees')} className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 cursor-pointer">
                <ArrowLeft size={16} /> All payees
            </button>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-lg font-bold text-slate-900">{payee.registered_name}</p>
                        <p className="text-xs text-slate-500">
                            TIN {payee.tin}-{payee.tin_branch} · <span className="capitalize">{String(payee.payee_type).replace(/_/g, '-')}</span>
                        </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${payee.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {payee.is_active ? 'Active' : 'Inactive'}
                    </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <StatCard label="Payments recorded" value={payments.length} />
                    <StatCard label="Total income payment" value={peso(totalIncome)} />
                    <StatCard label="Total tax withheld" value={peso(totalWithheld)} />
                </div>
            </div>

            {/* Income payments */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Receipt size={16} className="text-slate-400" />
                        <p className="text-sm font-semibold text-slate-900">Income Payments</p>
                    </div>
                    {canEdit && (
                        <CustomButton onClick={() => setPayForm({ ...BLANK_PAYMENT })}
                            icon={PlusIcon} iconPosition="left" className="w-auto! bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700">Add Payment</CustomButton>
                    )}
                </div>
                {payments.length === 0 ? (
                    <p className="text-sm text-slate-400">No payments recorded yet.</p>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {payments.map((p) => (
                            <div key={p.uuid} className="flex items-center justify-between py-2.5 text-sm">
                                <div>
                                    <span className="font-mono text-xs font-semibold text-slate-700">{p.atc_code}</span>
                                    <span className="ml-2 text-slate-600">{p.atc_description}</span>
                                    <div className="text-xs text-slate-400">
                                        {fmtDate(p.payment_date)} · Q{p.period_quarter} {p.period_year}
                                        {p.reference_no && <> · Ref: {p.reference_no}</>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <div className="text-slate-800">{peso(p.income_payment_amount)}</div>
                                        <div className="text-xs text-rose-600">−{peso(p.tax_withheld_amount)} withheld</div>
                                    </div>
                                    {canEdit && (
                                        <button onClick={async () => { try { await removePayment(p.uuid); } catch { /* handled */ } }}
                                            className="text-slate-300 hover:text-rose-500" title="Remove">
                                            <Trash2 size={15} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add payment modal */}
            <CustomModal isOpen={!!payForm} onClose={() => setPayForm(null)} title="Record Income Payment" size="md" showCloseButton hasRequiredFields
                footer={(
                    <div className="flex justify-center border-t border-slate-100 pt-4">
                        <CustomButton onClick={() => payFormikRef?.current?.submitForm()} isLoading={paymentBusy}
                            disabled={paymentBusy}
                            className="w-auto! bg-slate-800 px-5 hover:bg-slate-700">Record</CustomButton>
                    </div>
                )}
            >
                {payForm && (
                    <CustomForm
                        formRef={payFormikRef}
                        initialValues={payForm}
                        validationSchema={ewtPaymentValidationSchema}
                        onSubmit={submitPayment}
                        id="ewt-payment-form"
                        content={(errors, touched) => (
                            <div className="space-y-4 px-1">
                                <CustomDropdown label="ATC code" isRequired options={ATC_CODES} value={payForm.atc_code}
                                    renderProps="label" returnProps="value" placeholder="Choose ATC code..."
                                    onChange={(v) => setPayForm((p) => ({ ...p, atc_code: v }))} className="w-full items-start!"
                                    error={errors.atc_code && touched.atc_code} errorLabel={errors.atc_code} />
                                <div className="grid grid-cols-2 gap-4">
                                    <CustomInput label="Income payment" isRequired type="number" value={payForm.income_payment_amount}
                                        onChange={(e) => setPayForm((p) => ({ ...p, income_payment_amount: e.target.value }))}
                                        error={errors.income_payment_amount && touched.income_payment_amount} errorLabel={errors.income_payment_amount} />
                                    <CustomInput label="Tax withheld" isRequired type="number" value={payForm.tax_withheld_amount}
                                        onChange={(e) => setPayForm((p) => ({ ...p, tax_withheld_amount: e.target.value }))}
                                        error={errors.tax_withheld_amount && touched.tax_withheld_amount} errorLabel={errors.tax_withheld_amount} />
                                </div>
                                <CustomInput label="Payment date" isRequired type="date" value={payForm.payment_date}
                                    onChange={(e) => setPayForm((p) => ({ ...p, payment_date: e.target.value }))}
                                    error={errors.payment_date && touched.payment_date} errorLabel={errors.payment_date} />
                                <div className="grid grid-cols-2 gap-4">
                                    <CustomDropdown label="Year" isRequired options={YEAR_OPTS} value={payForm.period_year}
                                        renderProps="label" returnProps="value"
                                        onChange={(v) => setPayForm((p) => ({ ...p, period_year: v }))} className="w-full items-start!" />
                                    <CustomDropdown label="Quarter" isRequired options={QUARTER_OPTS} value={payForm.period_quarter}
                                        renderProps="label" returnProps="value"
                                        onChange={(v) => setPayForm((p) => ({ ...p, period_quarter: v }))} className="w-full items-start!" />
                                </div>
                                <CustomInput label="Reference no. (optional)" value={payForm.reference_no} placeholder="Invoice / OR number"
                                    onChange={(e) => setPayForm((p) => ({ ...p, reference_no: e.target.value }))}
                                    error={errors.reference_no && touched.reference_no} errorLabel={errors.reference_no} />
                            </div>
                        )}
                    />
                )}
            </CustomModal>
        </div>
    );
}

export default EwtPayeeDetail;
