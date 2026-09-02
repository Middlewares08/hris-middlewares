import { useMemo, useState } from 'react';
import moment from 'moment';
import { toast } from 'sonner';
import {
    FileText, PlusIcon, Save, ShieldAlert, Trash,
    ClipboardList, X,
    SearchAlert,
    File,
    Bell,
} from 'lucide-react';
import CustomModal from '../../components/CustomModal';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import CustomDropdown from '../../components/CustomDropdown';
import CustomLabel from '../../components/CustomLabel';
import { CustomFileUploader } from '../../components/CustomFileUploader';
import DocumentList from '../../components/document/DocumentList';
import NotFound from '../../components/NotFound';
import { can } from '../../utils/permissionCheck';
import { useEmployees } from '../../hooks/useEmployee';
import { useDocuments, usePendingEmployeeDocumentRequests } from '../../hooks/useDocuments';
import { buildDocumentForm, MAX_DOC_BYTES } from '../../services/documentServices';
import { BLANK } from '../../utils/constants';

const VIEW = 'employee-documents:view';

const REQ_TONE = {
    pending: 'bg-amber-100 text-amber-700',
    fulfilled: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-slate-200 text-slate-600',
    declined: 'bg-rose-100 text-rose-700',
};

const fmtDate = (v) => (v ? moment(v).format('MMM D, YYYY') : '—');

function Documents() {
    const { employees } = useEmployees({ page: 1, limit: 200, search: BLANK });
    const [employeeId, setEmployeeId] = useState(BLANK);

    const {
        documents, requests, isLoading, error,
        addDocument, deleteDocument, createRequest, cancelRequest, declineRequest, deleteRequest, isMutating,
    } = useDocuments(employeeId);

    // `source === 'employee'` → the employee asked HR; everything else → HR asked the employee.
    const hrRequests = useMemo(() => requests.filter((r) => r.source !== 'employee'), [requests]);
    const incomingRequests = useMemo(() => requests.filter((r) => r.source === 'employee'), [requests]);
    const pendingIncoming = incomingRequests.filter((r) => r.status === 'pending').length;

    const [reqForm, setReqForm] = useState(null);   // {label, note, due_date}
    const [docForm, setDocForm] = useState(null);   // {label, file, request?}
    const [declineFor, setDeclineFor] = useState(null); // request row
    const [declineReason, setDeclineReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [confirm, setConfirm] = useState(null);   // { kind, id, label }
    const [notifOpen, setNotifOpen] = useState(false);

    // Company-wide feed of still-open requests raised by employees — drives the header bell.
    const { data: pendingEmployeeRequests = [] } = usePendingEmployeeDocumentRequests();
    const notifCount = pendingEmployeeRequests.length;

    const employeeOptions = useMemo(
        () => (employees || []).map((e) => ({
            id: e.id, value: e.id, label: `${e.first_name} ${e.last_name}`,
        })),
        [employees],
    );

    // Open a specific employee's documents (from the notification bell).
    const jumpToEmployee = (empId) => {
        const match = employeeOptions.find((o) => String(o.value) === String(empId));
        setEmployeeId(match ? match.value : empId);
        setNotifOpen(false);
    };

    const submitRequest = async () => {
        try {
            await createRequest({
                employee_id: employeeId,
                label: reqForm.label.trim(),
                note: reqForm.note?.trim() || undefined,
                due_date: reqForm.due_date || undefined,
            });
            setReqForm(null);
        } catch { /* toast in hook */ }
    };

    const submitDocument = async () => {
        if (!docForm?.file?.file) return;
        if (docForm.file.file.size > MAX_DOC_BYTES) {
            toast.error('File is larger than 4MB.');
            return;
        }
        setBusy(true);
        try {
            await addDocument(buildDocumentForm({
                employeeId,
                label: docForm.label.trim() || docForm.file.name,
                file: docForm.file.file,
                documentRequestId: docForm.request?.id,
            }));
            setDocForm(null);
        } catch {
            /* addDocument shows its own toast */
        } finally {
            setBusy(false);
        }
    };

    const submitDecline = async () => {
        try {
            await declineRequest({ id: declineFor.id, payload: { review_remarks: declineReason.trim() } });
            setDeclineFor(null);
            setDeclineReason('');
        } catch { /* toast in hook */ }
    };

    const runConfirm = async () => {
        const { kind, id } = confirm;
        try {
            if (kind === 'doc') await deleteDocument(id);
            if (kind === 'req-cancel') await cancelRequest(id);
            if (kind === 'req-delete') await deleteRequest(id);
            setConfirm(null);
        } catch { /* handled */ }
    };

    if (!can(VIEW)) return <NotFound />;

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <CustomLabel
                    children='Employee Documents'
                    variant="h2"
                    addedClass="font-bold text-slate-700!"
                    description="View an employee's documents, answer their requests, and ask for new ones."
                    descriptionClass='text-xs'
                  />

                {/* Notification bell — pending requests raised by employees */}
                <div className="relative shrink-0">
                    <button
                        type="button"
                        onClick={() => setNotifOpen((o) => !o)}
                        className="relative rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 cursor-pointer"
                        title="Employee document requests"
                        aria-label={`${notifCount} pending employee document request${notifCount === 1 ? '' : 's'}`}
                    >
                        <Bell size={18} />
                        {notifCount > 0 && (
                            <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                                {notifCount > 9 ? '9+' : notifCount}
                            </span>
                        )}
                    </button>

                    {notifOpen && (
                        <>
                            <div className="fixed inset-0 z-20" onClick={() => setNotifOpen(false)} />
                            <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Employee Requests
                                    </p>
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                        {notifCount} pending
                                    </span>
                                </div>
                                {notifCount === 0 ? (
                                    <p className="px-4 py-6 text-center text-xs text-slate-400">Nothing waiting on you.</p>
                                ) : (
                                    <ul className="max-h-[60vh] divide-y divide-slate-50 space-y-4 overflow-y-auto scrollbar-y-visible text-left!">
                                        {pendingEmployeeRequests.map((r) => (
                                            <li key={r.id}>
                                               
                                                <button
                                                    type="button"
                                                    onClick={() => jumpToEmployee(r.employee?.id ?? r.employee_id)}
                                                    className="flex w-full px-4 py-3 transition-colors hover:bg-slate-50 cursor-pointer text-left"
                                                >
                                                    <div className='my-auto px-3 border-l-2 border-green-400 py-3'>
                                                        <FileText size={23} color='gray'/>

                                                    </div>
                                                    <div>
                                                        <p className="truncate text-sm font-medium text-slate-800">{r.label}</p>
                                                        <p className="mt-0.5 truncate text-xs text-slate-500">
                                                            {r.employee ? `${r.employee.first_name} ${r.employee.last_name}` : `Employee #${r.employee_id}`}
                                                            {' · '}
                                                            {fmtDate(r.created_at)}
                                                        </p>

                                                    </div>
                                                    
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="max-w-md">
                <CustomDropdown
                    searchable
                    label="Employee"
                    options={employeeOptions}
                    value={employeeId}
                    renderProps="label"
                    returnProps="value"
                    placeholder="Choose an employee..."
                    onChange={(v) => setEmployeeId(v)}
                    className="w-full items-start!"
                />
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    <ShieldAlert size={16} /> {error}
                </div>
            )}

            {!employeeId ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">
                    Select an employee to see their documents.
                </div>
            ) : isLoading ? (
                <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
            ) : (
              <div className="space-y-6">
                {/* Incoming requests — the employee asked HR for a document */}
                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-4 flex items-center gap-2">
                        <ClipboardList size={16} className="text-slate-400" />
                        <p className="text-sm font-semibold text-slate-900">Incoming Requests</p>
                        {pendingIncoming > 0 && (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700">
                                {pendingIncoming} pending
                            </span>
                        )}
                    </div>

                    {incomingRequests.length === 0 ? (
                        <>
                            <div className='flex justify-center pb-3'>
                                <SearchAlert size={40} color='gray'/>
                            </div>
                            <p className="text-xs text-slate-400">This employee hasn't requested anything.</p>
                        </>
                    ) : (
                        <ul className="space-y-2 text-left">
                            {incomingRequests.map((r) => (
                                <li key={r.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-slate-800">{r.label}</p>
                                            {r.note && <p className="mt-0.5 text-xs text-slate-500">{r.note}</p>}
                                            <p className="mt-1 text-[11px] text-slate-400">Requested {fmtDate(r.created_at)}</p>
                                            {r.status === 'declined' && r.review_remarks && (
                                                <p className="mt-1 text-[11px] text-rose-500">Declined: {r.review_remarks}</p>
                                            )}
                                            {r.status === 'fulfilled' && r.fulfilledDocument?.file_url && (
                                                <a href={r.fulfilledDocument.file_url} target="_blank" rel="noreferrer"
                                                    className="mt-1 inline-block text-[11px] font-semibold text-indigo-600 hover:underline">
                                                    View delivered file
                                                </a>
                                            )}
                                        </div>
                                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${REQ_TONE[r.status]}`}>
                                            {r.status}
                                        </span>
                                    </div>
                                    {r.status === 'pending' && (
                                        <div className="mt-2 flex gap-3 text-xs">
                                            {can('employee-documents:create') && (
                                                <button onClick={() => setDocForm({ label: r.label, file: null, request: r })}
                                                    className="font-semibold text-emerald-600 hover:underline cursor-pointer">Fulfill</button>
                                            )}
                                            {can('employee-documents:edit') && (
                                                <button onClick={() => { setDeclineFor(r); setDeclineReason(BLANK); }}
                                                    className="font-semibold text-rose-500 hover:underline cursor-pointer">Decline</button>
                                            )}
                                            {can('employee-documents:delete') && (
                                                <button onClick={() => setConfirm({ kind: 'req-delete', id: r.id, label: r.label })}
                                                    className="font-semibold text-slate-500 hover:underline cursor-pointer">Remove</button>
                                            )}
                                        </div>
                                    )}
                                    {r.status !== 'pending' && can('employee-documents:delete') && (
                                        <div className="mt-2 flex gap-3 text-xs">
                                            <button onClick={() => setConfirm({ kind: 'req-delete', id: r.id, label: r.label })}
                                                className="font-semibold text-rose-500 hover:underline cursor-pointer">Remove</button>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Document requests — HR asked the employee for a document */}
                    <section className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ClipboardList size={16} className="text-slate-400" />
                                <p className="text-sm font-semibold text-slate-900">Document Requests</p>
                            </div>
                            {can('employee-documents:create') && (
                                <CustomButton
                                    children='Request'
                                    onClick={() => setReqForm({ label: BLANK, note: BLANK, due_date: BLANK })}
                                    icon={PlusIcon} iconPosition="left"
                                    className='flex py-2 items-center gap-2 hover:cursor-pointer px-4 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors shadow-xs'
                                />

                            )}
                        </div>

                        {hrRequests.length === 0 ? (
                            <>
                                <div className='flex justify-center pb-3'>
                                    <SearchAlert size={40} color='gray'/>
                                </div>
                                <p className="text-xs text-slate-400">No requests found..</p>
                            </>

                        ) : (
                            <ul className="space-y-2 text-left">
                                {hrRequests.map((r) => (
                                    <li key={r.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-slate-800">{r.label}</p>
                                                {r.note && <p className="mt-0.5 text-xs text-slate-500">{r.note}</p>}
                                                <p className="mt-1 text-[11px] text-slate-400">
                                                    {r.due_date ? `Due ${fmtDate(r.due_date)} · ` : BLANK}Requested {fmtDate(r.created_at)}
                                                </p>
                                            </div>
                                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${REQ_TONE[r.status]}`}>
                                                {r.status}
                                            </span>
                                        </div>
                                        <div className="mt-2 flex gap-3 text-xs">
                                            {r.status === 'pending' && can('employee-documents:edit') && (
                                                <button onClick={() => setConfirm({ kind: 'req-cancel', id: r.id, label: r.label })}
                                                    className="font-semibold text-amber-600 hover:underline cursor-pointer">Cancel</button>
                                            )}
                                            {can('employee-documents:delete') && (
                                                <button onClick={() => setConfirm({ kind: 'req-delete', id: r.id, label: r.label })}
                                                    className="font-semibold text-rose-500 hover:underline cursor-pointer">Remove</button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {/* Document library */}
                    <section className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileText size={16} className="text-slate-400" />
                                <p className="text-sm font-semibold text-slate-900">Documents ({documents.length})</p>
                            </div>
                            {can('employee-documents:create') && (
                                <CustomButton 
                                    children='Add'
                                    onClick={() => setDocForm({ label: BLANK, file: null })}
                                    icon={PlusIcon} iconPosition="left"
                                    className='flex py-2 items-center gap-2 hover:cursor-pointer px-4 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors shadow-xs'
                                />
                            )}
                        </div>

                        <DocumentList
                            emptyLabel={
                                <>
                                    <div className='flex justify-center pb-3'>
                                        <File size={40} color='gray'/>
                                    </div>
                                    <p className="text-xs text-slate-400">No file found..</p>
                                </>
                            }
                            documents={documents}
                            canDelete={can('employee-documents:delete')}
                            onDelete={(d) => setConfirm({ kind: 'doc', id: d.id, label: d.label })}
                        />
                    </section>
                </div>
              </div>
            )}

            {/* Request modal */}
            <CustomModal
                isOpen={!!reqForm}
                onClose={() => setReqForm(null)}
                title="Request a document"
                size="md"
                showCloseButton
                hasRequiredFields
                footer={(
                    <div className="flex justify-center border-t border-slate-100 pt-4">
                        <CustomButton 
                            children='Send Request'
                            onClick={submitRequest} 
                            icon={Save} 
                            iconPosition="left"
                            isLoading={isMutating} disabled={isMutating || !reqForm?.label?.trim()}
                            className='flex py-2 items-center gap-2 hover:cursor-pointer px-4 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors shadow-xs'
                        />
                    </div>
                )}
            >
                {reqForm && (
                    <div className="space-y-4 px-1 pb-3">
                        <CustomInput label="Document" isRequired value={reqForm.label} placeholder="e.g. NBI Clearance"
                            onChange={(e) => setReqForm((p) => ({ ...p, label: e.target.value }))} />
                        <div className='text-left'>
                            <label className="mb-1 block text-xs font-medium text-slate-700">Note</label>
                            <textarea rows={3} value={reqForm.note} maxLength={500}
                                onChange={(e) => setReqForm((p) => ({ ...p, note: e.target.value }))}
                                placeholder="Instructions for the employee (optional)"
                                className="w-full resize-none rounded-lg border border-gray-300 p-2 text-sm focus:outline-gray-600" />
                        </div>
                        <CustomInput label="Due date" type="date" value={reqForm.due_date}
                            onChange={(e) => setReqForm((p) => ({ ...p, due_date: e.target.value }))} />
                    </div>
                )}
            </CustomModal>

            {/* Add-document modal (also used to fulfill an employee's request) */}
            <CustomModal
                isOpen={!!docForm}
                onClose={() => setDocForm(null)}
                title={docForm?.request ? `Fulfill: ${docForm.request.label}` : 'Add a document'}
                size="md"
                showCloseButton
                hasRequiredFields
                footer={(
                    <div className="flex justify-center border-t border-slate-100 pt-4">
                        <CustomButton
                            children={docForm?.request ? 'Deliver Document' : 'Save Document'}
                            onClick={submitDocument}
                            icon={Save} iconPosition="left"
                            isLoading={busy || isMutating}
                            disabled={busy || isMutating || !docForm?.file}
                            className='flex py-2 items-center gap-2 hover:cursor-pointer px-4 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors shadow-xs'
                        />
                    </div>
                )}
            >
                {docForm && (
                    <div className="space-y-4 px-1 pb-3">
                        <CustomInput label="Label" value={docForm.label} placeholder="Defaults to the file name"
                            disabled={!!docForm.request}
                            onChange={(e) => setDocForm((p) => ({ ...p, label: e.target.value }))} />
                        {docForm.request?.note && (
                            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{docForm.request.note}</p>
                        )}
                        <CustomFileUploader
                            label="File" isRequired
                            value={docForm.file}
                            onChange={(f) => setDocForm((p) => ({ ...p, file: f }))}
                            description="Image or PDF up to 4MB"
                        />
                        {docForm.request && (
                            <p className="text-[11px] text-slate-400">
                                This file is delivered to the employee and marks their request fulfilled.
                            </p>
                        )}
                    </div>
                )}
            </CustomModal>

            {/* Decline request modal */}
            <CustomModal
                isOpen={!!declineFor}
                onClose={() => { setDeclineFor(null); setDeclineReason(BLANK); }}
                title="Decline request?"
                size="md"
                showCloseButton
                footer={(
                    <div className="flex gap-3 border-t border-slate-100 pt-4">
                        <CustomButton onClick={() => { setDeclineFor(null); setDeclineReason(BLANK); }}
                            className="flex-1 border border-slate-200 bg-white! text-slate-700! hover:bg-slate-100!">Cancel</CustomButton>
                        <CustomButton variant="danger" icon={X} iconPosition="left" isLoading={isMutating}
                            disabled={isMutating || !declineReason.trim()} onClick={submitDecline} className="flex-1">Decline</CustomButton>
                    </div>
                )}
            >
                <div className="space-y-3 px-1">
                    <p className="text-sm text-slate-500">
                        {declineFor && <>Decline the request for <span className="font-semibold text-slate-800">{declineFor.label}</span>?</>}
                    </p>
                    <div className='text-left'>
                        <label className="mb-1 block text-xs font-medium text-slate-700">Reason <span className="text-rose-500">*</span></label>
                        <textarea rows={3} value={declineReason} maxLength={500}
                            onChange={(e) => setDeclineReason(e.target.value)}
                            placeholder="Let the employee know why this can't be provided"
                            className="w-full resize-none rounded-lg border border-gray-300 p-2 text-sm focus:outline-gray-600" />
                    </div>
                </div>
            </CustomModal>

            {/* Confirm modal */}
            <CustomModal isOpen={!!confirm} onClose={() => setConfirm(null)}
                title={confirm?.kind === 'doc' ? 'Archive document?' : confirm?.kind === 'req-cancel' ? 'Cancel request?' : 'Remove request?'}
                size="md">
                <div className="p-2 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-rose-100 bg-rose-50 text-rose-500">
                        <ShieldAlert size={26} />
                    </div>
                    <p className="mb-6 text-sm text-slate-500 pb-5">
                        <span className="font-semibold text-slate-800">{confirm?.label}</span>
                        {confirm?.kind === 'doc' ? ' will be archived.' : confirm?.kind === 'req-cancel' ? ' will be marked cancelled.' : ' will be removed.'}
                    </p>
                    <div className="flex gap-3 border-t border-slate-100 pt-4">
                        <CustomButton onClick={() => setConfirm(null)} className="flex-1 rounded-lg border border-slate-200 bg-white! text-slate-700! hover:bg-slate-100!">Keep</CustomButton>
                        <CustomButton 
                            children='Confirm'
                            variant="danger"
                            isLoading={isMutating} 
                            onClick={runConfirm} className="flex-1"
                            className='flex-1 py-2 items-center gap-2 hover:cursor-pointer px-4 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors shadow-xs'
                        />
                    </div>
                </div>
            </CustomModal>
        </div>
    );
}

export default Documents;
