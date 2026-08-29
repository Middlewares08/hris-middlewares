import { useMemo, useState } from 'react';
import moment from 'moment';
import { toast } from 'sonner';
import {
    FileText, Image as ImageIcon, PlusIcon, Save, ShieldAlert, Trash, Download,
    ClipboardList, X,
} from 'lucide-react';
import CustomModal from '../../components/CustomModal';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import CustomDropdown from '../../components/CustomDropdown';
import CustomLabel from '../../components/CustomLabel';
import { CustomFileUploader } from '../../components/CustomFileUploader';
import NotFound from '../../components/NotFound';
import { can } from '../../utils/permissionCheck';
import { useEmployees } from '../../hooks/useEmployee';
import { useDocuments } from '../../hooks/useDocuments';
import { buildDocumentForm, MAX_DOC_BYTES } from '../../services/documentServices';

const VIEW = 'employee-documents:view';

const REQ_TONE = {
    pending: 'bg-amber-100 text-amber-700',
    fulfilled: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-slate-200 text-slate-600',
};

const fmtDate = (v) => (v ? moment(v).format('MMM D, YYYY') : '—');
const fmtSize = (b) => (b ? `${(Number(b) / 1024 / 1024).toFixed(2)} MB` : '');

function Documents() {
    const { employees } = useEmployees({ page: 1, limit: 200, search: '' });
    const [employeeId, setEmployeeId] = useState('');

    const {
        documents, requests, isLoading, error,
        addDocument, deleteDocument, createRequest, cancelRequest, deleteRequest, isMutating,
    } = useDocuments(employeeId);

    const [reqForm, setReqForm] = useState(null);   // {label, note, due_date}
    const [docForm, setDocForm] = useState(null);   // {label, file}
    const [busy, setBusy] = useState(false);
    const [confirm, setConfirm] = useState(null);   // { kind, id, label }

    const employeeOptions = useMemo(
        () => (employees || []).map((e) => ({
            id: e.id, value: e.id, label: `${e.first_name} ${e.last_name}`,
        })),
        [employees],
    );

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
            }));
            setDocForm(null);
        } catch {
            /* addDocument shows its own toast */
        } finally {
            setBusy(false);
        }
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
            <div className="border-b border-slate-100 pb-4">
                <CustomLabel variant="h2" addedClass="font-bold text-slate-700!" description="View an employee's documents and request new ones.">
                    Employee Documents
                </CustomLabel>
            </div>

            <div className="max-w-md">
                <CustomDropdown
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
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Document requests */}
                    <section className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ClipboardList size={16} className="text-slate-400" />
                                <p className="text-sm font-semibold text-slate-900">Document Requests</p>
                            </div>
                            {can('employee-documents:create') && (
                                <CustomButton onClick={() => setReqForm({ label: '', note: '', due_date: '' })}
                                    icon={PlusIcon} iconPosition="left"
                                    className="bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700">Request</CustomButton>
                            )}
                        </div>

                        {requests.length === 0 ? (
                            <p className="text-sm text-slate-400">No requests yet.</p>
                        ) : (
                            <ul className="space-y-2">
                                {requests.map((r) => (
                                    <li key={r.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-slate-800">{r.label}</p>
                                                {r.note && <p className="mt-0.5 text-xs text-slate-500">{r.note}</p>}
                                                <p className="mt-1 text-[11px] text-slate-400">
                                                    {r.due_date ? `Due ${fmtDate(r.due_date)} · ` : ''}Requested {fmtDate(r.created_at)}
                                                </p>
                                            </div>
                                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${REQ_TONE[r.status]}`}>
                                                {r.status}
                                            </span>
                                        </div>
                                        <div className="mt-2 flex gap-3 text-xs">
                                            {r.status === 'pending' && can('employee-documents:edit') && (
                                                <button onClick={() => setConfirm({ kind: 'req-cancel', id: r.id, label: r.label })}
                                                    className="font-semibold text-amber-600 hover:underline">Cancel</button>
                                            )}
                                            {can('employee-documents:delete') && (
                                                <button onClick={() => setConfirm({ kind: 'req-delete', id: r.id, label: r.label })}
                                                    className="font-semibold text-rose-500 hover:underline">Remove</button>
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
                                <CustomButton onClick={() => setDocForm({ label: '', file: null })}
                                    icon={PlusIcon} iconPosition="left"
                                    className="bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700">Add</CustomButton>
                            )}
                        </div>

                        {documents.length === 0 ? (
                            <p className="text-sm text-slate-400">No documents on file.</p>
                        ) : (
                            <ul className="space-y-2">
                                {documents.map((d) => (
                                    <li key={d.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500">
                                            {d.type === 'image' ? <ImageIcon size={16} /> : <FileText size={16} />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-slate-800">{d.label}</p>
                                            <p className="text-[11px] text-slate-400">
                                                {d.source === 'employee' ? 'Uploaded by employee' : 'Added by HR'} · {fmtDate(d.created_at)}
                                                {fmtSize(d.size_bytes) && ` · ${fmtSize(d.size_bytes)}`}
                                            </p>
                                        </div>
                                        <a href={d.file_url || d.file_link} target="_blank" rel="noreferrer" download={d.file_name || d.label}
                                            className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700" title="Open / download">
                                            <Download size={15} />
                                        </a>
                                        {can('employee-documents:delete') && (
                                            <button onClick={() => setConfirm({ kind: 'doc', id: d.id, label: d.label })}
                                                className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-rose-600" title="Archive">
                                                <Trash size={15} />
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
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
                        <CustomButton onClick={submitRequest} icon={Save} iconPosition="left"
                            isLoading={isMutating} disabled={isMutating || !reqForm?.label?.trim()}
                            className="bg-slate-800 px-5 py-2.5 text-sm hover:bg-slate-700">Send Request</CustomButton>
                    </div>
                )}
            >
                {reqForm && (
                    <div className="space-y-4 px-1">
                        <CustomInput label="Document" isRequired value={reqForm.label} placeholder="e.g. NBI Clearance"
                            onChange={(e) => setReqForm((p) => ({ ...p, label: e.target.value }))} />
                        <div>
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

            {/* Add-document modal */}
            <CustomModal
                isOpen={!!docForm}
                onClose={() => setDocForm(null)}
                title="Add a document"
                size="md"
                showCloseButton
                hasRequiredFields
                footer={(
                    <div className="flex justify-center border-t border-slate-100 pt-4">
                        <CustomButton onClick={submitDocument} icon={Save} iconPosition="left"
                            isLoading={busy || isMutating} disabled={busy || isMutating || !docForm?.file}
                            className="bg-slate-800 px-5 py-2.5 text-sm hover:bg-slate-700">Save Document</CustomButton>
                    </div>
                )}
            >
                {docForm && (
                    <div className="space-y-4 px-1">
                        <CustomInput label="Label" value={docForm.label} placeholder="Defaults to the file name"
                            onChange={(e) => setDocForm((p) => ({ ...p, label: e.target.value }))} />
                        <CustomFileUploader
                            label="File" isRequired
                            value={docForm.file}
                            onChange={(f) => setDocForm((p) => ({ ...p, file: f }))}
                            description="Image or PDF up to 4MB"
                        />
                    </div>
                )}
            </CustomModal>

            {/* Confirm modal */}
            <CustomModal isOpen={!!confirm} onClose={() => setConfirm(null)}
                title={confirm?.kind === 'doc' ? 'Archive document?' : confirm?.kind === 'req-cancel' ? 'Cancel request?' : 'Remove request?'}
                size="md">
                <div className="p-2 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-rose-100 bg-rose-50 text-rose-500">
                        <ShieldAlert size={26} />
                    </div>
                    <p className="mb-6 text-sm text-slate-500">
                        <span className="font-semibold text-slate-800">{confirm?.label}</span>
                        {confirm?.kind === 'doc' ? ' will be archived.' : confirm?.kind === 'req-cancel' ? ' will be marked cancelled.' : ' will be removed.'}
                    </p>
                    <div className="flex gap-3 border-t border-slate-100 pt-4">
                        <CustomButton onClick={() => setConfirm(null)} className="flex-1 border border-slate-200 bg-white! text-slate-700! hover:bg-slate-100!">Keep</CustomButton>
                        <CustomButton variant="danger" icon={confirm?.kind === 'req-cancel' ? X : Trash} iconPosition="left"
                            isLoading={isMutating} onClick={runConfirm} className="flex-1">Confirm</CustomButton>
                    </div>
                </div>
            </CustomModal>
        </div>
    );
}

export default Documents;
