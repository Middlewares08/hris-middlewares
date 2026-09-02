import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Calculator, CheckCircle2, BadgeDollarSign, XCircle, PlusIcon, Trash2, Receipt, Download,
} from 'lucide-react';
import { CustomDataTable } from '../../components/CustomDataTable';
import CustomModal from '../../components/CustomModal';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import CustomDropdown from '../../components/CustomDropdown';
import CustomForm from '../../components/CustomForm';
import Loading from '../../components/Loading';
import NotFound from '../../components/NotFound';
import { can } from '../../utils/permissionCheck';
import { useEmployees } from '../../hooks/useEmployee';
import {
    usePayrollRun, usePayslips, usePayslip, useRunAdjustments, downloadPayslipPdf,
} from '../../hooks/usePayroll';
import { ADJUSTMENT_TYPES, peso, fmtDate } from './payrollOptions';
import { payrollAdjustmentValidationSchema } from '../../validation/payroll-adjustment-validation';
import Pill from './Pill';

const VIEW = 'run-payroll:view';
const EDIT = 'run-payroll:edit';

function StatCard({ label, value, strong }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-400">{label}</p>
            <p className={`mt-1 ${strong ? 'text-xl font-semibold text-slate-900' : 'text-base font-medium text-slate-700'}`}>{value}</p>
        </div>
    );
}

function PayslipModal({ uuid, onClose }) {
    const { payslip, isLoading } = usePayslip(uuid);
    const [downloading, setDownloading] = useState(false);

    const doDownload = async () => {
        setDownloading(true);
        try { await downloadPayslipPdf(payslip.uuid); } finally { setDownloading(false); }
    };

    return (
        <CustomModal 
            isOpen={!!uuid} 
            onClose={onClose} 
            title="Payslip" 
            size="lg" 
            showCloseButton
        >
            {isLoading || !payslip ? (
                <Loading size="sm" text="Loading payslip" />
            ) : (
                <div className="max-h-[65vh] space-y-4 overflow-y-auto scrollbar-y-visible px-1 pb-7">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-semibold text-slate-900">
                                {payslip.employee ? `${payslip.employee.first_name} ${payslip.employee.last_name}` : `Employee #${payslip.employee_id}`}
                            </p>
                            <p className="text-xs text-slate-400">{payslip.run?.period?.name}</p>
                        </div>
                        <Pill value={payslip.status} />
                    </div>

                    <div className='flex justify-between'>
                        <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-xs text-slate-500">Net pay</p>
                            <p className="text-2xl font-semibold text-slate-900">{peso(payslip.net_pay)}</p>
                            <p className="text-[11px] text-slate-400">{peso(payslip.gross_pay)} gross − {peso(payslip.total_deductions)} deductions</p>
                        </div>
                        <div className='my-auto'>
                            <CustomButton
                                children='Generate PDF'
                                onClick={doDownload}
                                isLoading={downloading}
                                icon={Download}
                                iconPosition="left"
                                className='flex py-2 items-center gap-2 hover:cursor-pointer px-4 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors shadow-xs'
                            />

                        </div>
                        
                    </div>
                    
                    {['earning', 'deduction', 'employer_contribution'].map((lt) => {
                        const lines = (payslip.lines || []).filter((l) => l.line_type === lt);
                        if (!lines.length) return null;
                        return (
                            <div key={lt}>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{lt.replace(/_/g, ' ')}</p>
                                <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                                    {lines.map((l) => (
                                        <div key={l.uuid || l.id} className="flex justify-between px-3 py-2 text-sm">
                                            <span className="text-slate-600">{l.label}</span>
                                            <span className="font-medium text-slate-800">{peso(l.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </CustomModal>
    );
}

function PayrollRunDetail() {
    const { uuid } = useParams();
    const navigate = useNavigate();

    const { run, isLoading, error, calculate, approve, markPaid, cancel, isBusy } = usePayrollRun(uuid);
    const { payslips, isLoading: slipsLoading } = usePayslips({ payroll_run_id: run?.id });
    const { adjustments, create: createAdj, remove: removeAdj, isMutating: adjBusy } = useRunAdjustments(uuid);
    const { employees } = useEmployees({ page: 1, limit: 200, search: '' });

    const [payslipUuid, setPayslipUuid] = useState(null);
    const [payModal, setPayModal] = useState(false);
    const [payRef, setPayRef] = useState('');
    const [adjForm, setAdjForm] = useState(null);
    const adjFormikRef = useRef(null);

    if (!can(VIEW)) return <NotFound />;
    if (isLoading) return <Loading size="lg" text="Loading run" fullPage />;
    if (error || !run) {
        return (
            <div className="mx-auto max-w-3xl p-8 text-center">
                <p className="text-slate-500">{error || 'Payroll run not found.'}</p>
                <CustomButton onClick={() => navigate('/dashboard/payroll/runs')} className="mt-4 w-auto! px-4">Back to runs</CustomButton>
            </div>
        );
    }

    const canEdit = can(EDIT);
    const empOptions = (employees || []).map((e) => ({ id: e.id, value: e.id, label: `${e.first_name} ${e.last_name}` }));

    const doCalculate = async () => { try { await calculate({}); } catch { /* handled */ } };
    const doApprove = async () => { try { await approve(); } catch { /* handled */ } };
    const doCancel = async () => { try { await cancel(); } catch { /* handled */ } };
    const doMarkPaid = async () => {
        try { await markPaid(payRef ? { payment_reference: payRef } : {}); setPayModal(false); setPayRef(''); } catch { /* handled */ }
    };
    const submitAdj = async () => {
        try {
            await createAdj({
                employee_id: Number(adjForm.employee_id),
                adjustment_type: adjForm.adjustment_type,
                label: adjForm.label,
                amount: Number(adjForm.amount),
                is_taxable: !!adjForm.is_taxable,
                reason: adjForm.reason,
            });
            setAdjForm(null);
        } catch { /* handled */ }
    };

    const slipColumns = [
        {
            header: 'Employee',
            render: (r) => (
                <div className="font-medium text-slate-800">
                    {r.employee ? `${r.employee.first_name} ${r.employee.last_name}` : `#${r.employee_id}`}
                </div>
            ),
        },
        { header: 'Gross', render: (r) => peso(r.gross_pay) },
        { header: 'Deductions', render: (r) => peso(r.total_deductions) },
        { header: 'Tax', render: (r) => peso(r.withholding_tax) },
        { header: 'Net', render: (r) => <span className="font-semibold text-slate-800">{peso(r.net_pay)}</span> },
        { header: 'Status', render: (r) => <Pill value={r.status} /> },
    ];

    return (
        <div className="mx-auto max-w-7xl space-y-6 text-left">
            <button onClick={() => navigate('/dashboard/payroll/runs')} className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 cursor-pointer">
                <ArrowLeft size={16} /> All runs
            </button>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-lg font-bold text-slate-900">{run.period?.name || `Period #${run.pay_period_id}`}</p>
                        <p className="text-xs capitalize text-slate-500">
                            {String(run.run_type).replace(/_/g, ' ')} · run #{run.run_number}
                            {run.period && <> · {fmtDate(run.period.period_start)}–{fmtDate(run.period.period_end)}</>}
                        </p>
                    </div>
                    <Pill value={run.status} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    <StatCard label="Employees" value={run.employee_count ?? 0} />
                    <StatCard label="Gross" value={peso(run.total_gross)} />
                    <StatCard label="Deductions" value={peso(run.total_deductions)} />
                    <StatCard label="Net pay" value={peso(run.total_net)} strong />
                    <StatCard label="Employer cost" value={peso(run.total_employer_cost)} />
                </div>

                {canEdit && (
                    <div className="mt-5 flex flex-wrap gap-2 pt-4">
                        {['draft', 'calculating', 'calculated'].includes(run.status) && (
                            <CustomButton onClick={doCalculate} icon={Calculator} iconPosition="left" isLoading={isBusy}
                                className="w-auto! bg-sky-600 px-4 hover:bg-sky-700">
                                {run.status === 'calculated' ? 'Recalculate' : 'Calculate'}
                            </CustomButton>
                        )}
                        {run.status === 'calculated' && (
                            <CustomButton onClick={doApprove} icon={CheckCircle2} iconPosition="left" isLoading={isBusy}
                                className="w-auto! bg-indigo-600 px-4 hover:bg-indigo-700">Approve</CustomButton>
                        )}
                        {run.status === 'approved' && (
                            <CustomButton onClick={() => setPayModal(true)} icon={BadgeDollarSign} iconPosition="left"
                                className="w-auto! bg-emerald-600 px-4 hover:bg-emerald-700">Mark Paid</CustomButton>
                        )}
                        {!['paid', 'cancelled'].includes(run.status) && (
                            <CustomButton onClick={doCancel} icon={XCircle} iconPosition="left" isLoading={isBusy} variant="danger"
                                className="w-auto! px-4">Cancel</CustomButton>
                        )}
                    </div>
                )}
            </div>

            {/* Adjustments */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">Queued Adjustments</p>
                    {canEdit && ['draft', 'calculated'].includes(run.status) && (
                        <CustomButton onClick={() => setAdjForm({ employee_id: '', adjustment_type: 'earning', label: '', amount: '', is_taxable: false, reason: '' })}
                            icon={PlusIcon} iconPosition="left" className="w-auto! bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700">Add</CustomButton>
                    )}
                </div>
                {adjustments.length === 0 ? (
                    <p className="text-sm text-slate-400">No adjustments queued. They apply on the next calculation.</p>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {adjustments.map((a) => (
                            <div key={a.uuid} className="flex items-center justify-between py-2.5 text-sm">
                                <div>
                                    <span className="font-medium text-slate-800">{a.label}</span>
                                    <span className="ml-2 text-xs text-slate-400">
                                        {a.employee ? `${a.employee.first_name} ${a.employee.last_name}` : `#${a.employee_id}`} · {a.adjustment_type}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Pill value={a.status} />
                                    <span className={a.adjustment_type === 'deduction' ? 'text-rose-600' : 'text-emerald-600'}>
                                        {a.adjustment_type === 'deduction' ? '−' : '+'}{peso(a.amount)}
                                    </span>
                                    {canEdit && a.status === 'pending' && (
                                        <button onClick={async () => { try { await removeAdj(a.uuid); } catch { /* handled */ } }}
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

            {/* Payslips */}
            <div>
                <div className="mb-2 flex items-center gap-2">
                    <Receipt size={16} className="text-slate-400" />
                    <p className="text-sm font-semibold text-slate-900">Payslips</p>
                </div>
                <CustomDataTable
                    data={payslips}
                    columns={slipColumns}
                    isLoading={slipsLoading}
                    searchPlaceholder="Search employee..."
                    onRowClick={(r) => setPayslipUuid(r.uuid)}
                />
            </div>

            <PayslipModal uuid={payslipUuid} onClose={() => setPayslipUuid(null)} />

            {/* Mark paid modal */}
            <CustomModal isOpen={payModal} onClose={() => setPayModal(false)} title="Mark run as paid" size="md" showCloseButton
                footer={(
                    <div className="flex justify-center border-t border-slate-100 pt-4">
                        <CustomButton onClick={doMarkPaid} isLoading={isBusy} icon={BadgeDollarSign} iconPosition="left"
                            className="w-auto! bg-emerald-600 px-5 hover:bg-emerald-700">Confirm & Release</CustomButton>
                    </div>
                )}
            >
                <div className="space-y-3 px-1">
                    <p className="text-sm text-slate-500">Releases all payslips in this run to employees. This cannot be undone.</p>
                    <CustomInput label="Payment reference (optional)" value={payRef} placeholder="Bank batch / transfer ref"
                        onChange={(e) => setPayRef(e.target.value)} />
                </div>
            </CustomModal>

            {/* Adjustment modal */}
            <CustomModal isOpen={!!adjForm} onClose={() => setAdjForm(null)} title="Queue Adjustment" size="md" showCloseButton hasRequiredFields
                footer={(
                    <div className="flex justify-center border-t border-slate-100 pt-4">
                        <CustomButton onClick={() => adjFormikRef?.current?.submitForm()} isLoading={adjBusy}
                            disabled={adjBusy}
                            className="w-auto! bg-slate-800 px-5 hover:bg-slate-700">Queue</CustomButton>
                    </div>
                )}
            >
                {adjForm && (
                    <CustomForm
                        formRef={adjFormikRef}
                        initialValues={adjForm}
                        validationSchema={payrollAdjustmentValidationSchema}
                        onSubmit={submitAdj}
                        id="payroll-adjustment-form"
                        content={(errors, touched) => (
                            <div className="space-y-4 px-1">
                                <CustomDropdown label="Employee" isRequired options={empOptions} value={adjForm.employee_id}
                                    renderProps="label" returnProps="value" placeholder="Choose employee..." searchable searchPlaceholder="Search employee..."
                                    onChange={(v) => setAdjForm((p) => ({ ...p, employee_id: v }))} className="w-full items-start!"
                                    error={errors.employee_id && touched.employee_id} errorLabel={errors.employee_id} />
                                <div className="grid grid-cols-2 gap-4">
                                    <CustomDropdown label="Type" options={ADJUSTMENT_TYPES} value={adjForm.adjustment_type}
                                        renderProps="label" returnProps="value"
                                        onChange={(v) => setAdjForm((p) => ({ ...p, adjustment_type: v }))} className="w-full items-start!"
                                        error={errors.adjustment_type && touched.adjustment_type} errorLabel={errors.adjustment_type} />
                                    <CustomInput label="Amount" isRequired type="number" value={adjForm.amount}
                                        onChange={(e) => setAdjForm((p) => ({ ...p, amount: e.target.value }))}
                                        error={errors.amount && touched.amount} errorLabel={errors.amount} />
                                </div>
                                <CustomInput label="Label" isRequired value={adjForm.label} placeholder="Perfect attendance bonus"
                                    onChange={(e) => setAdjForm((p) => ({ ...p, label: e.target.value }))}
                                    error={errors.label && touched.label} errorLabel={errors.label} />
                                <CustomInput label="Reason" isRequired value={adjForm.reason}
                                    onChange={(e) => setAdjForm((p) => ({ ...p, reason: e.target.value }))}
                                    error={errors.reason && touched.reason} errorLabel={errors.reason} />
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <input type="checkbox" checked={adjForm.is_taxable} className="h-4 w-4 rounded border-slate-300"
                                        onChange={(e) => setAdjForm((p) => ({ ...p, is_taxable: e.target.checked }))} />
                                    Taxable
                                </label>
                            </div>
                        )}
                    />
                )}
            </CustomModal>
        </div>
    );
}

export default PayrollRunDetail;
