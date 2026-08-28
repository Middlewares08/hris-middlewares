import { useState } from 'react';
import moment from 'moment';
import { PlusIcon, Save, ShieldAlert, Trash, Megaphone, Pin, Send, Archive, Undo2 } from 'lucide-react';
import { CustomDataTable } from '../../components/CustomDataTable';
import CustomModal from '../../components/CustomModal';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import CustomDropdown from '../../components/CustomDropdown';
import CustomDatePicker from '../../components/CustomDatePicker';
import CustomLabel from '../../components/CustomLabel';
import NotFound from '../../components/NotFound';
import { can } from '../../utils/permissionCheck';
import { useAnnouncements } from '../../hooks/useAnnouncement';

const VIEW = 'announcements:view';

const PRIORITY_OPTIONS = [
    { id: 'info', value: 'info', label: 'Info' },
    { id: 'important', value: 'important', label: 'Important' },
    { id: 'urgent', value: 'urgent', label: 'Urgent' },
];

const STATUS_OPTIONS = [
    { id: 'draft', value: 'draft', label: 'Draft' },
    { id: 'published', value: 'published', label: 'Published' },
    { id: 'archived', value: 'archived', label: 'Archived' },
];

const TONE = {
    info: 'bg-sky-100 text-sky-700',
    important: 'bg-amber-100 text-amber-700',
    urgent: 'bg-rose-100 text-rose-700',
    draft: 'bg-slate-100 text-slate-600',
    published: 'bg-emerald-100 text-emerald-700',
    archived: 'bg-slate-200 text-slate-600',
};

const Pill = ({ value }) => (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${TONE[value] || 'bg-slate-100 text-slate-600'}`}>
        {String(value || '').replace(/_/g, ' ')}
    </span>
);

const fmtDate = (v) => (v ? moment(v).format('MMM D, YYYY h:mm A') : '—');

const BLANK = {
    title: '', body: '', priority: 'info', status: 'draft',
    is_pinned: false, published_at: null, expires_at: null, link_url: '',
};

const s = (v) => (v === null || v === undefined ? '' : String(v));

const toForm = (row) => ({
    ...BLANK,
    ...row,
    body: s(row.body),
    link_url: s(row.link_url),
    published_at: row.published_at ? new Date(row.published_at) : null,
    expires_at: row.expires_at ? new Date(row.expires_at) : null,
});

const Check = ({ label, checked, onChange }) => (
    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
        {label}
    </label>
);

function Announcements() {
    const { items, isLoading, error, create, update, setStatus, remove, isMutating } = useAnnouncements();
    const [form, setForm] = useState(null);       // null = closed; object = create/edit
    const [toDelete, setToDelete] = useState(null);

    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const submit = async () => {
        const payload = {
            title: form.title.trim(),
            body: form.body.trim(),
            priority: form.priority,
            status: form.status,
            is_pinned: Boolean(form.is_pinned),
            published_at: form.published_at ? new Date(form.published_at).toISOString() : null,
            expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
            link_url: form.link_url.trim() || null,
        };
        try {
            if (form.uuid) await update({ uuid: form.uuid, payload });
            else await create(payload);
            setForm(null);
        } catch { /* toast handled in hook */ }
    };

    const changeStatus = async (row, status) => {
        try { await setStatus({ uuid: row.uuid, status }); } catch { /* handled */ }
    };

    const columns = [
        {
            header: 'Announcement',
            render: (r) => (
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-600">
                        <Megaphone size={16} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                            {r.is_pinned && <Pin size={12} className="text-amber-500" />}
                            <span className="truncate">{r.title}</span>
                        </div>
                        <div className="truncate text-xs text-slate-400">{r.body}</div>
                    </div>
                </div>
            ),
        },
        { header: 'Priority', render: (r) => <Pill value={r.priority} /> },
        { header: 'Status', render: (r) => <Pill value={r.status} /> },
        { header: 'Published', render: (r) => <span className="text-sm text-slate-600">{fmtDate(r.published_at)}</span> },
        { header: 'Expires', render: (r) => <span className="text-sm text-slate-600">{fmtDate(r.expires_at)}</span> },
        { header: 'Created', render: (r) => <span className="text-sm text-slate-600">{fmtDate(r.created_at)}</span> },
    ];

    const drawer = (row, close) => (
        <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-lg font-bold text-slate-900">{row.title}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                    <Pill value={row.priority} />
                    <Pill value={row.status} />
                    {row.is_pinned && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">pinned</span>}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{row.body}</p>
                {row.link_url && (
                    <a href={row.link_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-blue-600 underline">
                        {row.link_url}
                    </a>
                )}
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div><dt className="text-xs text-slate-400">Publish at</dt><dd>{fmtDate(row.published_at)}</dd></div>
                    <div><dt className="text-xs text-slate-400">Expires at</dt><dd>{fmtDate(row.expires_at)}</dd></div>
                </dl>
            </div>

            {can('announcements:edit') && (
                <div className="flex flex-wrap gap-2">
                    {row.status !== 'published' && (
                        <CustomButton onClick={() => { close(); changeStatus(row, 'published'); }} icon={Send} iconPosition="left"
                            variant="primary" className="flex-1 bg-emerald-50! text-emerald-700! border border-emerald-200 hover:bg-emerald-100!">Publish</CustomButton>
                    )}
                    {row.status !== 'draft' && (
                        <CustomButton onClick={() => { close(); changeStatus(row, 'draft'); }} icon={Undo2} iconPosition="left"
                            variant="primary" className="flex-1 bg-white! text-slate-700! border border-slate-200 hover:bg-slate-100!">Revert to draft</CustomButton>
                    )}
                    {row.status !== 'archived' && (
                        <CustomButton onClick={() => { close(); changeStatus(row, 'archived'); }} icon={Archive} iconPosition="left"
                            variant="primary" className="flex-1 bg-amber-50! text-amber-700! border border-amber-200 hover:bg-amber-100!">Archive</CustomButton>
                    )}
                </div>
            )}

            <div className="flex gap-2">
                {can('announcements:edit') && (
                    <CustomButton onClick={() => { close(); setForm(toForm(row)); }}
                        variant="primary" className="flex-1 bg-white! text-blue-700! border border-slate-200 hover:bg-blue-50!">Edit</CustomButton>
                )}
                {can('announcements:delete') && (
                    <CustomButton onClick={() => { close(); setToDelete(row); }}
                        variant="primary" className="flex-1 bg-rose-50! text-rose-600! border border-rose-200 hover:bg-rose-100!">Delete</CustomButton>
                )}
            </div>
        </div>
    );

    if (!can(VIEW)) return <NotFound />;

    const canSubmit = form && form.title?.trim() && form.body?.trim();

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="border-b border-slate-100 pb-4">
                <CustomLabel variant="h2" addedClass="font-bold text-slate-700!" description="Company-wide announcements broadcast to the employee dashboard feed.">
                    Announcements
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
                searchPlaceholder="Search announcements..."
                renderDrawerContent={drawer}
                actionButton={can('announcements:create') && (
                    <CustomButton onClick={() => setForm({ ...BLANK })} icon={PlusIcon} iconPosition="left"
                        className="flex items-center gap-2 bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700">New Announcement</CustomButton>
                )}
            />

            <CustomModal
                isOpen={!!form}
                onClose={() => setForm(null)}
                title={form?.uuid ? 'Edit Announcement' : 'New Announcement'}
                size="lg"
                showCloseButton
                hasRequiredFields
                footer={(
                    <div className="flex justify-center border-t border-slate-100 pt-4">
                        <CustomButton onClick={submit} icon={Save} iconPosition="left" isLoading={isMutating}
                            disabled={isMutating || !canSubmit}
                            className="bg-slate-800 px-5 py-2.5 text-sm hover:bg-slate-700">
                            {form?.uuid ? 'Save Changes' : 'Create Announcement'}
                        </CustomButton>
                    </div>
                )}
            >
                {form && (
                    <div className="max-h-[60vh] space-y-4 overflow-y-auto px-1">
                        <CustomInput label="Title" isRequired value={s(form.title)} placeholder="Office closed on Friday"
                            onChange={(e) => set('title', e.target.value)} />

                        <div className="flex w-full flex-col space-y-1">
                            <label className="text-xs font-medium text-gray-700">
                                Body <span className="ml-1 text-red-500">*</span>
                            </label>
                            <textarea
                                rows="5"
                                value={s(form.body)}
                                onChange={(e) => set('body', e.target.value)}
                                placeholder="Write the announcement details here..."
                                className="w-full resize-none rounded-lg border border-gray-300 p-2 text-sm focus:outline-gray-600"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <CustomDropdown label="Priority" isRequired options={PRIORITY_OPTIONS} value={form.priority}
                                renderProps="label" returnProps="value" onChange={(v) => set('priority', v)} className="w-full items-start!" />
                            <CustomDropdown label="Status" isRequired options={STATUS_OPTIONS} value={form.status}
                                renderProps="label" returnProps="value" onChange={(v) => set('status', v)} className="w-full items-start!" />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <CustomDatePicker label="Publish at" className="text-left!" value={form.published_at}
                                onChange={(date) => set('published_at', date)} placeholder="Immediately" />
                            <CustomDatePicker label="Expires at" className="text-left!" value={form.expires_at}
                                minDate={form.published_at || null}
                                onChange={(date) => set('expires_at', date)} placeholder="Never" />
                        </div>

                        <CustomInput label="Link URL" value={s(form.link_url)} placeholder="https://..."
                            onChange={(e) => set('link_url', e.target.value)} />

                        <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <Check label="Pin to top of feed" checked={form.is_pinned} onChange={(v) => set('is_pinned', v)} />
                        </div>
                        <p className="text-xs text-slate-400">
                            Only <span className="font-semibold">published</span> announcements inside their publish/expiry window appear on the employee dashboard.
                        </p>
                    </div>
                )}
            </CustomModal>

            <CustomModal isOpen={!!toDelete} onClose={() => setToDelete(null)} title="Delete announcement?" size="md">
                <div className="p-2 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-rose-100 bg-rose-50 text-rose-500">
                        <ShieldAlert size={26} />
                    </div>
                    <p className="mb-6 text-sm text-slate-500">
                        Delete <span className="font-semibold text-slate-800">{toDelete?.title}</span>? It will be removed from the feed and the admin list.
                    </p>
                    <div className="flex gap-3 border-t border-slate-100 pt-4">
                        <CustomButton onClick={() => setToDelete(null)} className="flex-1 border border-slate-200 bg-white! text-slate-700! hover:bg-slate-100!">Cancel</CustomButton>
                        <CustomButton variant="danger" icon={Trash} iconPosition="left" isLoading={isMutating}
                            onClick={async () => { try { await remove(toDelete.uuid); setToDelete(null); } catch { /* handled */ } }}
                            className="flex-1">Delete</CustomButton>
                    </div>
                </div>
            </CustomModal>
        </div>
    );
}

export default Announcements;
