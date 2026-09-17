// src/pages/LicenseExpired.jsx
import { useState } from 'react';
import { KeyRound, Mail, ShieldAlert, ShieldCheck } from 'lucide-react';
import CustomButton from '../components/CustomButton';
import CustomInput from '../components/CustomInput';
import { useActivateLicense, useLicenseStatus } from '../hooks/useLicense';

function LicenseExpired() {
    const { hasLicense } = useLicenseStatus();
    const { activate, isActivating, error } = useActivateLicense();
    const [form, setForm] = useState({ productKey: '', email: '' });
    const [done, setDone] = useState(false);

    const onChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

    const onSubmit = async (e) => {
        e.preventDefault();
        try {
            await activate(form);
            setDone(true);
        } catch {
            // Surfaced via `error` below.
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl shadow-lg shadow-black/5 ring-1 ring-black/5 p-10 w-full max-w-sm space-y-6">
                <div className="space-y-1 text-center">
                    <ShieldAlert size={32} className="mx-auto text-rose-500" />
                    <p className="text-xl font-semibold text-slate-900">
                        {hasLicense ? 'License expired' : 'No active license'}
                    </p>
                    <p className="text-sm text-slate-500">
                        {hasLicense
                            ? "This deployment's license has expired and access is currently blocked."
                            : 'This deployment has no active license on record and access is currently blocked.'}
                        {' '}Enter a product key below to restore access.
                    </p>
                </div>

                {done ? (
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <ShieldCheck size={20} className="shrink-0 text-emerald-600" />
                        <p className="text-sm text-emerald-800">License activated. You can log in now.</p>
                    </div>
                ) : (
                    <form onSubmit={onSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium p-3 rounded-lg text-center">
                                {error}
                            </div>
                        )}
                        <CustomInput
                            label="Product key"
                            labelPosition="left"
                            icon={KeyRound}
                            iconPosition="left"
                            type="text"
                            value={form.productKey}
                            onChange={(e) => onChange('productKey', e.target.value)}
                            isRequired
                            placeholder="XXXX-XXXX-XXXX-XXXX"
                        />
                        <CustomInput
                            label="Your email"
                            labelPosition="left"
                            icon={Mail}
                            iconPosition="left"
                            type="email"
                            value={form.email}
                            onChange={(e) => onChange('email', e.target.value)}
                            isRequired
                            placeholder="you@example.com"
                        />
                        <CustomButton type="submit" disabled={isActivating} isLoading={isActivating} variant="primary">
                            Activate license
                        </CustomButton>
                    </form>
                )}

                <p className="text-xs text-slate-400 text-center">
                    Contact your administrator if you don't have a product key.
                </p>
            </div>
        </div>
    );
}

export default LicenseExpired;
