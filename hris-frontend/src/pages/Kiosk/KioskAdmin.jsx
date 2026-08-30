import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    ScanFace,
    ExternalLink,
    Plus,
    Trash2,
    Copy,
    RefreshCw,
    ShieldCheck,
    MonitorSmartphone,
} from 'lucide-react';
import moment from 'moment';
import CustomButton from '../../components/CustomButton';
import CustomModal from '../../components/CustomModal';
import Loading from '../../components/Loading';
import { kioskAdminService } from '../../services/kioskServices';
import { useSettings } from '../../hooks/useSystem';
import { can } from '../../utils/permissionCheck';

const KIOSK_URL = `${window.location.origin}/kiosk`;

function ToggleRow({ on, disabled, onToggle, title, hint }) {
    return (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${on ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    <ShieldCheck size={16} />
                </div>
                <div>
                    <p className="text-sm font-semibold text-slate-800">{title}</p>
                    <p className="text-xs text-slate-400">{hint}</p>
                </div>
            </div>
            <button
                type="button"
                disabled={disabled}
                onClick={onToggle}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}
                aria-pressed={on}
            >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
        </div>
    );
}

export default function KioskAdmin() {
    const qc = useQueryClient();
    const canEdit = can('attendance-kiosk:edit');
    const canCreate = can('attendance-kiosk:create');
    const canDelete = can('attendance-kiosk:delete');

    const { values, isLoading: settingsLoading, updateSetting, isSaving } = useSettings();
    const kioskOn = values['face.kiosk_enabled'] === true;

    const { data: devicesRes, isLoading } = useQuery({
        queryKey: ['kioskDevices'],
        queryFn: kioskAdminService.listDevices,
    });
    const devices = devicesRes?.data || [];

    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState({ name: '', location: '' });
    const [newToken, setNewToken] = useState(null); // { token, name }

    const createMut = useMutation({
        mutationFn: kioskAdminService.createDevice,
        onSuccess: (res) => {
            setNewToken({ token: res.data.token, name: res.data.name });
            setForm({ name: '', location: '' });
            qc.invalidateQueries({ queryKey: ['kioskDevices'] });
        },
        onError: (e) => toast.error(e?.response?.data?.message || 'Could not register device.'),
    });

    const revokeMut = useMutation({
        mutationFn: kioskAdminService.revokeDevice,
        onSuccess: () => {
            toast.success('Device revoked.');
            qc.invalidateQueries({ queryKey: ['kioskDevices'] });
        },
        onError: (e) => toast.error(e?.response?.data?.message || 'Could not revoke device.'),
    });

    const reindexMut = useMutation({
        mutationFn: kioskAdminService.reindex,
        onSuccess: (res) => {
            const d = res.data || {};
            toast.success(`Re-indexed: ${d.indexed} added, ${d.failed} failed (of ${d.candidates}).`);
        },
        onError: (e) => toast.error(e?.response?.data?.message || 'Re-index failed.'),
    });

    const copy = (text) => {
        navigator.clipboard?.writeText(text).then(
            () => toast.success('Copied'),
            () => toast.error('Copy failed'),
        );
    };

    const closeModal = () => {
        setModalOpen(false);
        setNewToken(null);
        setForm({ name: '', location: '' });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
                        <ScanFace size={20} />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800">Attendance Kiosk</h1>
                        <p className="text-sm text-slate-500">
                            A shared screen that identifies employees by face and clocks them in / out.
                        </p>
                    </div>
                </div>
                <CustomButton
                    size="sm"
                    icon={ExternalLink}
                    iconPosition="left"
                    className="w-auto! px-4"
                    onClick={() => window.open('/kiosk', '_blank', 'noopener')}
                >
                    Launch Kiosk
                </CustomButton>
            </div>

            {/* Master switch */}
            <div className="space-y-3">
                <ToggleRow
                    title="Attendance kiosk enabled"
                    hint={
                        kioskOn
                            ? 'Registered kiosks can identify employees and record attendance.'
                            : 'Kiosks are switched off — the /kiosk screen will not verify anyone.'
                    }
                    on={kioskOn}
                    disabled={!canEdit || settingsLoading || isSaving}
                    onToggle={() => updateSetting({ key: 'face.kiosk_enabled', value: !kioskOn })}
                />
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                            <RefreshCw size={16} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-800">Re-index enrolled faces</p>
                            <p className="text-xs text-slate-400">
                                Adds every enrolled face to the kiosk search collection. Run once after enabling,
                                or if the kiosk stops recognizing people.
                            </p>
                        </div>
                    </div>
                    <CustomButton
                        size="sm"
                        className="w-auto! px-4"
                        disabled={!canEdit}
                        isLoading={reindexMut.isPending}
                        onClick={() => reindexMut.mutate()}
                    >
                        Re-index
                    </CustomButton>
                </div>
            </div>

            {/* Devices */}
            <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                    <div className="flex items-center gap-2">
                        <MonitorSmartphone size={16} className="text-slate-400" />
                        <p className="text-sm font-semibold text-slate-800">Registered devices</p>
                    </div>
                    {canCreate && (
                        <CustomButton
                            size="sm"
                            icon={Plus}
                            iconPosition="left"
                            className="w-auto! px-3"
                            onClick={() => setModalOpen(true)}
                        >
                            Register device
                        </CustomButton>
                    )}
                </div>

                {isLoading ? (
                    <div className="p-8"><Loading size="sm" text="Loading devices" /></div>
                ) : devices.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-slate-400">
                        No kiosk devices yet. Register one, then open the token on that device.
                    </p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                                <th className="px-5 py-2.5 font-medium">Name</th>
                                <th className="px-5 py-2.5 font-medium">Location</th>
                                <th className="px-5 py-2.5 font-medium">Token</th>
                                <th className="px-5 py-2.5 font-medium">Last seen</th>
                                <th className="px-5 py-2.5 font-medium">Status</th>
                                <th className="px-5 py-2.5" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {devices.map((d) => (
                                <tr key={d.uuid} className="text-slate-700">
                                    <td className="px-5 py-3 font-medium">{d.name}</td>
                                    <td className="px-5 py-3 text-slate-500">{d.location || '—'}</td>
                                    <td className="px-5 py-3 font-mono text-xs text-slate-400">{d.token_prefix}…</td>
                                    <td className="px-5 py-3 text-slate-500">
                                        {d.last_seen_at ? moment(d.last_seen_at).fromNow() : 'never'}
                                    </td>
                                    <td className="px-5 py-3">
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                d.status === 'active'
                                                    ? 'bg-emerald-50 text-emerald-700'
                                                    : 'bg-slate-100 text-slate-500'
                                            }`}
                                        >
                                            {d.status}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        {canDelete && d.status === 'active' && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (window.confirm(`Revoke "${d.name}"? That device will stop working immediately.`)) {
                                                        revokeMut.mutate(d.uuid);
                                                    }
                                                }}
                                                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                                title="Revoke"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <CustomModal
                isOpen={modalOpen}
                onClose={closeModal}
                title={newToken ? 'Device registered' : 'Register kiosk device'}
                size="md"
                showCloseButton
                footer={
                    newToken ? (
                        <CustomButton size="sm" className="w-auto! px-5" onClick={closeModal}>
                            Done
                        </CustomButton>
                    ) : (
                        <>
                            <CustomButton
                                size="sm"
                                onClick={closeModal}
                                className="w-auto! px-4 bg-white! text-slate-600! border border-slate-200 hover:bg-slate-50!"
                            >
                                Cancel
                            </CustomButton>
                            <CustomButton
                                size="sm"
                                className="w-auto! px-5"
                                isLoading={createMut.isPending}
                                disabled={!form.name.trim()}
                                onClick={() => createMut.mutate({ name: form.name.trim(), location: form.location.trim() })}
                            >
                                Register
                            </CustomButton>
                        </>
                    )
                }
            >
                {newToken ? (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">
                            Open <span className="font-medium">{KIOSK_URL}</span> on <b>{newToken.name}</b> and paste
                            this token. It is shown <b>once</b> — copy it now.
                        </p>
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <code className="flex-1 break-all font-mono text-xs text-slate-700">{newToken.token}</code>
                            <button
                                type="button"
                                onClick={() => copy(newToken.token)}
                                className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
                            >
                                <Copy size={15} />
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => copy(`${KIOSK_URL}\n${newToken.token}`)}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                        >
                            Copy URL + token
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-slate-500">Device name</label>
                            <input
                                autoFocus
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. Lobby tablet"
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-500">Location (optional)</label>
                            <input
                                value={form.location}
                                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                                placeholder="e.g. Ground floor entrance"
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                            />
                        </div>
                    </div>
                )}
            </CustomModal>
        </div>
    );
}
