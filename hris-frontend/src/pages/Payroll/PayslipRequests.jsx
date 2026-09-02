import { useState } from 'react';
import moment from 'moment';
import { ShieldAlert, Receipt, X } from 'lucide-react';
import { CustomDataTable } from '../../components/CustomDataTable';
import CustomModal from '../../components/CustomModal';
import CustomButton from '../../components/CustomButton';
import CustomLabel from '../../components/CustomLabel';
import NotFound from '../../components/NotFound';
import { can } from '../../utils/permissionCheck';
import { usePayslipRequests, downloadPayslipPdf } from '../../hooks/usePayroll';
import Pill from './Pill';
import { fmtDate } from './payrollOptions';

const VIEW = 'run-payroll:view';
const EDIT = 'run-payroll:edit';
const DELETE = 'run-payroll:delete';

const employeeName = (e) => (e ? `${e.first_name} ${e.last_name}`.trim() : '—');
const periodLabel = (payslip) => {
    const p = payslip?.run?.period;
    if (p?.name) return p.name;
    if (p?.period_start && p?.period_end) return `${fmtDate(p.period_start)} – ${fmtDate(p.period_end)}`;
    return 'Payslip';
};

function PayslipRequests() {
    const { items, isLoading, error, fulfill, reject, remove, isMutating } = usePayslipRequests();
    const [toReject, setToReject] = useState(null);
    const [rejectRemarks, setRejectRemarks] = useState('');
    const [toDelete, setToDelete] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);

    const doDownload = async (payslipUuid, id) => {
        setDownloadingId(id);
        try { await downloadPayslipPdf(payslipUuid); } finally { setDownloadingId(null); }
    };

    const doFulfill = async (row, close) => {
        try { await fulfill({ uuid: row.uuid, payload: {} }); close?.(); } catch { /* handled */ }
    };

    const submitReject = async () => {
        try {
            await reject({ uuid: toReject.uuid, payload: { review_remarks: rejectRemarks.trim() } });
            setToReject(null);
            setRejectRemarks('');
        } catch { /* handled */ }
    };

    const columns = [
        {
            header: 'Employee',
            render: (r) => (
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-600">
                        <Receipt size={16} />
                    </div>
                    <div>
                        <div className="font-semibold text-slate-900">{employeeName(r.employee)}</div>
                        <div className="text-xs text-slate-400">{r.employee?.employee_id || `#${r.employee_id}`}</div>
                    </div>
                </div>
            ),
        },
        { header: 'Payslip period', render: (r) => <span className="text-sm text-slate-700">{periodLabel(r.payslip)}</span> },
        { header: 'Purpose', render: (r) => <span className="line-clamp-1 max-w-[24ch] text-sm text-slate-600">{r.reason}</span> },
        { header: 'Status', render: (r) => <Pill value={r.status} /> },
        { header: 'Requested', render: (r) => <span className="text-sm text-slate-600">{fmtDate(r.created_at)}</span> },
        { header: 'Reviewed by', render: (r) => <span className="text-sm text-slate-600">{r.reviewer ? employeeName(r.reviewer) : '—'}</span> },
    ];

    const drawer = (row, close) => (
        <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-lg font-bold text-slate-900">{employeeName(row.employee)}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2 pb-3">
                    <Pill value={row.status} />
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {periodLabel(row.payslip)}
                    </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
                    <span className="text-xs font-semibold uppercase text-slate-400">Purpose</span><br />
                    {row.reason}
                </p>
                {row.reviewed_at && (
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div><dt className="text-xs text-slate-400">Reviewed by</dt><dd>{employeeName(row.reviewer)}</dd></div>
                        <div><dt className="text-xs text-slate-400">Reviewed at</dt><dd>{moment(row.reviewed_at).format('MMM D, YYYY h:mm A')}</dd></div>
                        {row.review_remarks && <div className="col-span-2"><dt className="text-xs text-slate-400">Remarks</dt><dd>{row.review_remarks}</dd></div>}
                    </dl>
                )}
            </div>

            {row.payslip?.uuid && (
                <CustomButton
                    children="Download PDF"
                    isLoading={downloadingId === row.id}
                    onClick={() => doDownload(row.payslip.uuid, row.id)}
                    variant="primary"
                    className="w-full py-2 text-xs bg-slate-800! text-white! hover:bg-slate-700!"
                />
            )}

            {row.status === 'pending' && can(EDIT) && (
                <div className="flex gap-2">
                    <CustomButton
                        children="Fulfill"
                        onClick={() => doFulfill(row, close)}
                        isLoading={isMutating}
                        variant="primary"
                        className="flex-1 py-2 text-xs bg-emerald-50! text-emerald-700! border border-emerald-200 hover:bg-emerald-100!"
                    />
                    <CustomButton
                        children="Reject"
                        onClick={() => { close(); setToReject(row); }}
                        variant="primary"
                        className="flex-1 py-2 text-xs bg-rose-50! text-rose-600! border border-rose-200 hover:bg-rose-100!"
                    />
                </div>
            )}

            {can(DELETE) && (
                <CustomButton
                    children="Archive"
                    onClick={() => { close(); setToDelete(row); }}
                    variant="primary"
                    className="w-full py-2 text-xs bg-white! text-slate-700! border border-slate-200 hover:bg-slate-100!"
                />
            )}
        </div>
    );

    if (!can(VIEW)) return <NotFound />;

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="border-b border-slate-100 pb-4">
                <CustomLabel
                    variant="h2"
                    children="Payslip Requests"
                    descriptionClass="text-xs"
                    addedClass="font-bold text-slate-700!"
                    description="Employees request official copies of their released payslips. Fulfill a request, then download the branded PDF."
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
                searchPlaceholder="Search by employee or purpose..."
                renderDrawerContent={drawer}
            />

            <CustomModal
                isOpen={!!toReject}
                onClose={() => { setToReject(null); setRejectRemarks(''); }}
                title="Reject payslip request?"
                size="md"
                showCloseButton
                footer={(
                    <div className="flex gap-3 border-t border-slate-100 pt-4">
                        <CustomButton onClick={() => { setToReject(null); setRejectRemarks(''); }}
                            className="flex-1 border border-slate-200 bg-white! text-slate-700! hover:bg-slate-100!">Cancel</CustomButton>
                        <CustomButton variant="danger" icon={X} iconPosition="left" isLoading={isMutating}
                            disabled={!rejectRemarks.trim()} onClick={submitReject} className="flex-1">Reject</CustomButton>
                    </div>
                )}
            >
                <div className="space-y-3 px-1">
                    <p className="text-sm text-slate-500">
                        {toReject && <>Reject <span className="font-semibold text-slate-800">{employeeName(toReject.employee)}</span>'s request for {periodLabel(toReject.payslip)}?</>}
                    </p>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">Reason for rejection <span className="text-rose-500">*</span></label>
                        <textarea rows={3} value={rejectRemarks} maxLength={500}
                            onChange={(e) => setRejectRemarks(e.target.value)}
                            placeholder="Let the employee know why this was rejected"
                            className="w-full resize-none rounded-lg border border-gray-300 p-2 text-sm focus:outline-gray-600" />
                    </div>
                </div>
            </CustomModal>

            <CustomModal isOpen={!!toDelete} onClose={() => setToDelete(null)} title="Archive payslip request?" size="md">
                <div className="p-2 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-rose-100 bg-rose-50 text-rose-500">
                        <ShieldAlert size={26} />
                    </div>
                    <p className="mb-6 pb-4 text-sm text-slate-500">
                        {toDelete && <>Archive <span className="font-semibold text-slate-800">{employeeName(toDelete.employee)}</span>'s payslip request for {periodLabel(toDelete.payslip)}?</>}
                    </p>
                    <div className="flex gap-3 border-t border-slate-100 pt-4">
                        <CustomButton
                            children="Cancel"
                            onClick={() => setToDelete(null)}
                            className="flex-1 rounded-lg border border-slate-200 bg-white! py-2 text-center text-slate-700! hover:bg-slate-100!"
                        />
                        <CustomButton
                            children="Archive"
                            isLoading={isMutating}
                            className="flex-1 gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white shadow-xs transition-colors hover:cursor-pointer hover:bg-red-600"
                            onClick={async () => { try { await remove(toDelete.uuid); setToDelete(null); } catch { /* handled */ } }}
                        />
                    </div>
                </div>
            </CustomModal>
        </div>
    );
}

export default PayslipRequests;
