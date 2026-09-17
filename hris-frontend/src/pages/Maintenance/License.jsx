// src/pages/Maintenance/License.jsx
import moment from 'moment';
import { CalendarClock, CheckCircle2, Clock, KeyRound, Mail, ShieldAlert, Siren, Tag } from 'lucide-react';
import Loading from '../../components/Loading';
import { useLicenseActivations } from '../../hooks/useLicense';

const fmt = (v) => (v ? moment(v).format('MMM D, YYYY h:mm A') : '—');

function ActivationCard({ activation }) {
    const activated = !!activation.activatedAt;
    const perpetual = !activation.expiresAt;

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <KeyRound size={16} className="text-slate-400" />
                    <span className="font-mono text-sm font-semibold text-slate-800">{activation.productKeyMasked}</span>
                    {activation.licenseType && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                            <Tag size={12} /> {activation.licenseType}
                        </span>
                    )}
                    {activation.isStub && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            <ShieldAlert size={12} /> Unverified (stub mode)
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {activation.isExpired && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
                            <Siren size={12} /> Expired
                        </span>
                    )}
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${activated ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {activated ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        {activated ? 'Activated' : 'Pending'}
                    </span>
                </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center gap-1.5">
                    <Mail size={13} className="shrink-0 text-slate-400" />
                    <span className="truncate">{activation.sentToEmail}</span>
                </div>
                <div>
                    <span className="text-slate-400">Sent: </span>
                    {fmt(activation.sentAt)}
                </div>
                <div>
                    <span className="text-slate-400">Activated: </span>
                    {activated ? fmt(activation.activatedAt) : 'Not yet'}
                </div>
                <div className={`flex items-center gap-1.5 ${activation.isExpired ? 'text-rose-600 font-semibold' : ''}`}>
                    <CalendarClock size={13} className="shrink-0" />
                    {perpetual ? 'Never expires' : fmt(activation.expiresAt)}
                </div>
            </div>
        </div>
    );
}

function License() {
    const { activations, isLoading, error } = useLicenseActivations();

    if (isLoading) {
        return <Loading size="lg" text="Loading license activations" fullPage />;
    }

    return (
        <div className="mx-auto max-w-3xl space-y-6 pb-10">
            <div>
                <h1 className="text-lg font-bold text-slate-900">License</h1>
                <p className="text-sm text-slate-500">
                    Every time this deployment was activated through the Install Wizard — the key used (masked),
                    who it was emailed to, and whether they've finished setting their password.
                </p>
            </div>

            {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
            )}

            {!error && activations.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
                    No activations recorded yet.
                </div>
            )}

            <div className="space-y-3">
                {activations.map((activation) => (
                    <ActivationCard key={activation.uuid} activation={activation} />
                ))}
            </div>
        </div>
    );
}

export default License;
