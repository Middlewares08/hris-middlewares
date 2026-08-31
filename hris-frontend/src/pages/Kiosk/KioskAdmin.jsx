import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    ExternalLink,
    Plus,
    Trash2,
    Copy,
    RefreshCw,
    ShieldCheck,
    MonitorSmartphone,
    ScanFace,
} from 'lucide-react';
import moment from 'moment';
import CustomButton from '../../components/CustomButton';
import CustomModal from '../../components/CustomModal';
import CustomInput from '../../components/CustomInput';
import CustomForm from '../../components/CustomForm';
import Loading from '../../components/Loading';
import { kioskAdminService } from '../../services/kioskServices';
import { useSettings } from '../../hooks/useSystem';
import { can } from '../../utils/permissionCheck';
import CustomLabel from '../../components/CustomLabel';
import { kioskDeviceValidationSchema } from '../../validation/kiosk-device-validation';

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
    const formikRef = useRef(null);

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

    const submitDevice = () => {
        createMut.mutate({ name: form.name.trim(), location: form.location.trim() });
    };

    return (
        <div className="space-y-6 text-left">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <CustomLabel
                    variant='h2' 
                    children='Attendance Kiosk' 
                    addedClass='font-bold text-slate-700!' 
                    descriptionClass='text-xs text-slate-500'
                    description="A shared screen that identifies employees by face and clocks them in/out."
                />
                <CustomButton
                    children='Launch Kiosk'
                    onClick={() => window.open('/kiosk', '_blank', 'noopener')}
                    icon={ExternalLink}
                    iconPosition='left'
                    type='button'
                    className='flex py-4 px-3 items-center gap-2 hover:cursor-pointer px-4 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors shadow-xs'
                />
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
                        children='Re-index'
                        size="sm"
                        className='flex py-2 items-center gap-2 hover:cursor-pointer px-4 bg-slate-100 text-slate-600 hover:text-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors shadow-xs'
                        disabled={!canEdit}
                        isLoading={reindexMut.isPending}
                        onClick={() => reindexMut.mutate()}
                    />
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
                            children='Register device'
                            size="sm"
                            icon={Plus}
                            iconPosition="left"
                            className='flex py-2 items-center gap-2 hover:cursor-pointer px-4 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors shadow-xs'
                            onClick={() => setModalOpen(true)}
                        />
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
                title={newToken ? 'Device registered' : 'Register Kiosk Device'}
                size="md"
                showCloseButton
                footer={
                    !newToken && (
                        <>
                            <CustomButton
                                children='Cancel'
                                size="sm"
                                onClick={closeModal}
                                className='flex py-2 items-center gap-2 hover:cursor-pointer px-4 bg-slate-100 text-slate-600 hover:text-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors shadow-xs'
                            />
                            <CustomButton
                                children='Register'
                                size="sm"
                                className='flex py-2 items-center gap-2 hover:cursor-pointer px-6 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors shadow-xs'
                                isLoading={createMut.isPending}
                                disabled={createMut.isPending}
                                onClick={() => formikRef?.current?.submitForm()}
                            />
                        </>
                    )
                }
            >
                {newToken ? (
                    <div className="space-y-4 text-center pb-5">
                        
                        <div className='flex justify-center'><ScanFace size={70} color='indigo'/></div>
                        <p className="text-sm text-slate-600 pb-4">
                            Open <span className="font-medium">{KIOSK_URL}</span> on <b>{newToken.name}</b> and paste
                            this token. It is shown <b>once</b> — copy it now.
                        </p>
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <code className="flex-1 break-all font-mono text-xs text-slate-700">{newToken.token}</code>
                            <button
                                type="button"
                                onClick={() => copy(newToken.token)}
                                className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 cursor-pointer"
                            >
                                <Copy size={15} />
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => copy(`${KIOSK_URL}\n${newToken.token}`)}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer"
                        >
                            Copy URL + token
                        </button>
                    </div>
                ) : (
                    <CustomForm
                        formRef={formikRef}
                        initialValues={form}
                        validationSchema={kioskDeviceValidationSchema}
                        onSubmit={submitDevice}
                        id="kiosk-device-form"
                        content={(errors, touched) => (
                            <div className="space-y-4 pb-3">
                                <CustomInput
                                    label="Device name"
                                    isRequired
                                    value={form.name}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. Lobby tablet"
                                    error={errors.name && touched.name}
                                    errorLabel={errors.name}
                                />
                                <CustomInput
                                    label="Location (optional)"
                                    value={form.location}
                                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                                    placeholder="e.g. Ground floor entrance"
                                    error={errors.location && touched.location}
                                    errorLabel={errors.location}
                                />
                            </div>
                        )}
                    />
                )}
            </CustomModal>
        </div>
    );
}
