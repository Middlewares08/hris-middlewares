// src/pages/Install/InstallWizard.jsx
import { useState } from 'react';
import { KeyRound, Mail, ShieldCheck, User } from 'lucide-react';
import CustomButton from '../../components/CustomButton';
import CustomInput from '../../components/CustomInput';
import { useCompleteInstall, useValidateProductKey } from '../../hooks/useInstall';

const STEPS = { KEY: 'key', ADMIN: 'admin', DONE: 'done' };

function InstallWizard() {
    const [step, setStep] = useState(STEPS.KEY);
    const [productKey, setProductKey] = useState('');
    const [admin, setAdmin] = useState({ email: '', firstName: '', lastName: '' });
    const [result, setResult] = useState(null);

    const { validateKey, isValidating, error: keyError } = useValidateProductKey();
    const { completeInstall, isInstalling, error: installError } = useCompleteInstall();

    const onChangeAdmin = (field, value) => setAdmin((prev) => ({ ...prev, [field]: value }));

    const submitKey = async (e) => {
        e.preventDefault();
        try {
            await validateKey(productKey);
            setStep(STEPS.ADMIN);
        } catch {
            // Surfaced via keyError below.
        }
    };

    const submitAdmin = async (e) => {
        e.preventDefault();
        try {
            const res = await completeInstall({ productKey, ...admin });
            setResult(res);
            setStep(STEPS.DONE);
        } catch {
            // Surfaced via installError below.
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl shadow-lg shadow-black/5 ring-1 ring-black/5 p-10 w-full max-w-sm space-y-6">
                <div className="space-y-1 text-center">
                    <p className="text-2xl font-semibold leading-snug text-slate-900">Welcome to HRIS Middleware</p>
                    <p className="text-sm text-slate-500">
                        {step === STEPS.KEY && "Let's activate this installation."}
                        {step === STEPS.ADMIN && 'Create the first administrator account.'}
                        {step === STEPS.DONE && "You're almost there."}
                    </p>
                </div>

                {step === STEPS.KEY && (
                    <form onSubmit={submitKey} className="space-y-4">
                        {keyError && (
                            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium p-3 rounded-lg text-center">
                                {keyError}
                            </div>
                        )}
                        <CustomInput
                            label="Product key"
                            labelPosition="left"
                            icon={KeyRound}
                            iconPosition="left"
                            type="text"
                            value={productKey}
                            onChange={(e) => setProductKey(e.target.value)}
                            isRequired
                            placeholder="XXXX-XXXX-XXXX-XXXX"
                        />
                        <CustomButton type="submit" disabled={isValidating} isLoading={isValidating} variant="primary">
                            Continue
                        </CustomButton>
                    </form>
                )}

                {step === STEPS.ADMIN && (
                    <form onSubmit={submitAdmin} className="space-y-4">
                        {installError && (
                            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium p-3 rounded-lg text-center">
                                {installError}
                            </div>
                        )}
                        <CustomInput
                            label="First name"
                            labelPosition="left"
                            icon={User}
                            iconPosition="left"
                            type="text"
                            value={admin.firstName}
                            onChange={(e) => onChangeAdmin('firstName', e.target.value)}
                            isRequired
                        />
                        <CustomInput
                            label="Last name"
                            labelPosition="left"
                            icon={User}
                            iconPosition="left"
                            type="text"
                            value={admin.lastName}
                            onChange={(e) => onChangeAdmin('lastName', e.target.value)}
                            isRequired
                        />
                        <CustomInput
                            label="Email"
                            labelPosition="left"
                            icon={Mail}
                            iconPosition="left"
                            type="email"
                            value={admin.email}
                            onChange={(e) => onChangeAdmin('email', e.target.value)}
                            isRequired
                            placeholder="you@example.com"
                        />
                        <p className="text-xs text-slate-400">
                            We'll email this address a link to set your password — nothing to write down.
                        </p>
                        <CustomButton type="submit" disabled={isInstalling} isLoading={isInstalling} variant="primary">
                            Complete Installation
                        </CustomButton>
                    </form>
                )}

                {step === STEPS.DONE && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                            <ShieldCheck size={20} className="shrink-0 text-emerald-600" />
                            <p className="text-sm text-emerald-800">
                                {result?.message || 'Installation complete. Check your email for a link to set your password.'}
                            </p>
                        </div>
                        {result?.data?.devPreview?.link && (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 break-all">
                                <p className="mb-1 font-semibold text-slate-600">Dev preview (no mail provider configured):</p>
                                <a href={result.data.devPreview.link} className="text-indigo-600 underline">
                                    {result.data.devPreview.link}
                                </a>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default InstallWizard;
