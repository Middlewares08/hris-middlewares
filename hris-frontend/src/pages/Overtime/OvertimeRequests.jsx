import { useState } from 'react';
import moment from 'moment';
import { ShieldAlert, Clock, X, Power } from 'lucide-react';
import { CustomDataTable } from '../../components/CustomDataTable';
import CustomModal from '../../components/CustomModal';
import CustomButton from '../../components/CustomButton';
import CustomLabel from '../../components/CustomLabel';
import NotFound from '../../components/NotFound';
import { can } from '../../utils/permissionCheck';
import { useOvertimeRequests } from '../../hooks/useOvertime';
import { useSettings } from '../../hooks/useSystem';

const VIEW = 'overtime-tracker:view';

const TONE = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-rose-100 text-rose-700',
    cancelled: 'bg-slate-200 text-slate-600',
};

const Pill = ({ value }) => (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${TONE[value] || 'bg-slate-100 text-slate-600'}`}>
        {String(value || '').replace(/_/g, ' ')}
    </span>
);

const fmtDate = (v) => (v ? moment(v).format('MMM D, YYYY') : '—');
const employeeName = (e) => (e ? `${e.first_name} ${e.last_name}`.trim() : '—');

function FeatureToggle() {
    const { values, isLoading, updateSetting, isSaving } = useSettings();
    const enabled = values['overtime.enabled'] !== false;
    const canEdit = can('maintenance:edit');

    return (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-left">
            <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Power size={16} />
                </div>
                <div>
                    <p className="text-sm font-semibold text-slate-800">Overtime module</p>
                    <p className="text-xs text-slate-400">
                        {enabled
                            ? 'Employees can file overtime; approved hours are paid in payroll runs.'
                            : 'Filing is blocked and payroll ignores approved overtime.'}
                    </p>
                </div>
            </div>
            <button
                type="button"
                disabled={!canEdit || isLoading || isSaving}
                onClick={() => updateSetting({ key: 'overtime.enabled', value: !enabled })}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                aria-pressed={enabled}
                title={canEdit ? 'Toggle overtime module' : 'Requires maintenance:edit'}
            >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
        </div>
    );
}

function OvertimeRequests() {
    const { items, isLoading, error, review, remove, isMutating } = useOvertimeRequests();
    const [toReject, setToReject] = useState(null);
    const [rejectRemarks, setRejectRemarks] = useState('');
    const [toDelete, setToDelete] = useState(null);

    const approve = async (row, close) => {
        try { await review({ uuid: row.uuid, decision: 'approved' }); close?.(); } catch { /* handled */ }
    };

    const submitReject = async () => {
        try {
            await review({ uuid: toReject.uuid, decision: 'rejected', remarks: rejectRemarks.trim() || undefined });
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
                        <Clock size={16} />
                    </div>
                    <div>
                        <div className="font-semibold text-slate-900">{employeeName(r.employee)}</div>
                        <div className="text-xs text-slate-400">{fmtDate(r.work_date)}</div>
                    </div>
                </div>
            ),
        },
        { header: 'Hours', render: (r) => <span className="font-medium text-slate-700">{Number(r.hours)}h</span> },
        { header: 'Status', render: (r) => <Pill value={r.status} /> },
        { header: 'Reason', render: (r) => <span className="line-clamp-1 max-w-[22ch] text-sm text-slate-600">{r.reason}</span> },
        { header: 'Reviewed by', render: (r) => <span className="text-sm text-slate-600">{r.reviewer ? employeeName(r.reviewer) : '—'}</span> },
        { header: 'Filed', render: (r) => <span className="text-sm text-slate-600">{fmtDate(r.created_at)}</span> },
    ];

    const drawer = (row, close) => (
        <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-lg font-bold text-slate-900">{employeeName(row.employee)}</p>
                <div className="mt-2 flex flex-wrap gap-2 justify-center pb-3">
                    <Pill value={row.status} />
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {Number(row.hours)}h on {fmtDate(row.work_date)}
                    </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{row.reason}</p>
                {row.reviewed_at && (
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div><dt className="text-xs text-slate-400">Reviewed by</dt><dd>{employeeName(row.reviewer)}</dd></div>
                        <div><dt className="text-xs text-slate-400">Reviewed at</dt><dd>{moment(row.reviewed_at).format('MMM D, YYYY h:mm A')}</dd></div>
                        {row.review_remarks && <div className="col-span-2"><dt className="text-xs text-slate-400">Remarks</dt><dd>{row.review_remarks}</dd></div>}
                    </dl>
                )}
            </div>

            {row.status === 'pending' && can('overtime-tracker:edit') && (
                <div className="flex gap-2">
                    <CustomButton 
                        children='Approve'
                        onClick={() => approve(row, close)} 
                        isLoading={isMutating}
                        variant="primary" className="flex-1 py-2 text-xs bg-emerald-50! text-emerald-700! border border-emerald-200 hover:bg-emerald-100!"/>
                    <CustomButton 
                        children='Reject'
                        onClick={() => { close(); setToReject(row); }} 
                        variant="primary" className="flex-1 py-2 text-xs bg-rose-50! text-rose-600! border border-rose-200 hover:bg-rose-100!"
                    />
                </div>
            )}

            {can('overtime-tracker:delete') && (
                <CustomButton 
                    children='Archive'
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
                    children='Overtime Tracker'
                    descriptionClass='text-xs'
                    addedClass="font-bold text-slate-700!" 
                    description="Review employee overtime filings. Approved hours flow into payroll runs for the covered period."
                />
            </div>

            <FeatureToggle />

            {error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    <ShieldAlert size={16} /> {error}
                </div>
            )}

            <CustomDataTable
                data={items}
                columns={columns}
                isLoading={isLoading}
                searchPlaceholder="Search by employee or reason..."
                renderDrawerContent={drawer}
            />

            <CustomModal
                isOpen={!!toReject}
                onClose={() => { setToReject(null); setRejectRemarks(''); }}
                title="Reject overtime request?"
                size="md"
                showCloseButton
                footer={(
                    <div className="flex gap-3 border-t border-slate-100 pt-4">
                        <CustomButton onClick={() => { setToReject(null); setRejectRemarks(''); }}
                            className="flex-1 border border-slate-200 bg-white! text-slate-700! hover:bg-slate-100!">Cancel</CustomButton>
                        <CustomButton variant="danger" icon={X} iconPosition="left" isLoading={isMutating} onClick={submitReject}
                            className="flex-1">Reject</CustomButton>
                    </div>
                )}
            >
                <div className="space-y-3 px-1">
                    <p className="text-sm text-slate-500">
                        {toReject && <>Reject <span className="font-semibold text-slate-800">{employeeName(toReject.employee)}</span>'s {Number(toReject.hours)}h filing for {fmtDate(toReject.work_date)}?</>}
                    </p>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">Remarks (optional)</label>
                        <textarea rows={3} value={rejectRemarks} maxLength={500}
                            onChange={(e) => setRejectRemarks(e.target.value)}
                            placeholder="Why is this being rejected?"
                            className="w-full resize-none rounded-lg border border-gray-300 p-2 text-sm focus:outline-gray-600" />
                    </div>
                </div>
            </CustomModal>

            <CustomModal isOpen={!!toDelete} onClose={() => setToDelete(null)} title="Archive overtime request?" size="md">
                <div className="p-2 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-rose-100 bg-rose-50 text-rose-500">
                        <ShieldAlert size={26} />
                    </div>
                    <p className="mb-6 text-sm text-slate-500 pb-4">
                        {toDelete && <>Archive <span className="font-semibold text-slate-800">{employeeName(toDelete.employee)}</span>'s {Number(toDelete.hours)}h filing for {fmtDate(toDelete.work_date)}? It will stop counting toward payroll.</>}
                    </p>
                    <div className="flex gap-3 border-t border-slate-100 pt-4">
                        <CustomButton 
                            children='Cancel'
                            onClick={() => setToDelete(null)} 
                            className="flex-1 py-2 text-center border border-slate-200 bg-white! text-slate-700! hover:bg-slate-100! rounded-lg"
                        />
                        <CustomButton 
                            children='Archive'
                            isLoading={isMutating}
                            className='flex-1 py-2 items-center gap-2 hover:cursor-pointer px-4 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors shadow-xs'
                            onClick={async () => { try { await remove(toDelete.uuid); setToDelete(null); } catch { /* handled */ } }}
                        />
                    </div>
                </div>
            </CustomModal>
        </div>
    );
}

export default OvertimeRequests;
