// src/pages/Setup/SetupWizard.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Circle, PartyPopper, Power, Sparkles, Trash2 } from 'lucide-react';
import CustomButton from '../../components/CustomButton';
import CustomInput from '../../components/CustomInput';
import CustomModal from '../../components/CustomModal';
import Loading from '../../components/Loading';
import { can } from '../../utils/permissionCheck';
import { useLogout } from '../../hooks/useLogout';
import { useResetDatabase, useSetupStatus } from '../../hooks/useSetup';
import { useSettings } from '../../hooks/useSystem';

const WIZARD_KEY = 'setup.wizard_enabled';

/** Admin-only kill switch for the wizard itself — the config the feature is built around. */
function WizardToggle() {
    const { values, isLoading, updateSetting, isSaving } = useSettings();
    const enabled = values[WIZARD_KEY] !== false;
    const canEdit = can('maintenance:edit');

    return (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Power size={16} />
                </div>
                <div>
                    <p className="text-sm font-semibold text-slate-800">Setup wizard</p>
                    <p className="text-xs text-slate-400">
                        {enabled
                            ? 'Admins with pending steps are guided here on login.'
                            : 'Disabled — nobody is redirected here, regardless of progress.'}
                    </p>
                </div>
            </div>
            <button
                type="button"
                disabled={!canEdit || isLoading || isSaving}
                onClick={() => updateSetting({ key: WIZARD_KEY, value: !enabled })}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                aria-pressed={enabled}
                title={canEdit ? 'Toggle the setup wizard' : 'Requires maintenance:edit'}
            >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
        </div>
    );
}

function StepCard({ step }) {
    const navigate = useNavigate();
    const canAct = can(step.permission);

    return (
        <div className={`flex items-start justify-between gap-4 rounded-xl border p-4 ${step.done ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-start gap-3">
                {step.done
                    ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
                    : <Circle size={20} className="mt-0.5 shrink-0 text-slate-300" />}
                <div>
                    <p className="text-sm font-semibold text-slate-800">{step.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{step.description}</p>
                </div>
            </div>

            <CustomButton
                size="sm"
                variant={step.done ? 'outline' : 'primary'}
                disabled={!canAct}
                onClick={() => navigate(step.actionPath)}
                className="shrink-0"
                title={canAct ? undefined : `Requires ${step.permission}`}
            >
                {step.done ? 'Review' : 'Set up'}
            </CustomButton>
        </div>
    );
}

/** Admin-only, env-gated full database wipe — only ever rendered when the server opts in. */
function DangerZone({ resetAllowed }) {
    const canReset = resetAllowed && can('setup-wizard:reset');
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmEmail, setConfirmEmail] = useState('');
    const { resetDatabase, isResetting, error } = useResetDatabase();
    const logout = useLogout();

    if (!canReset) return null;

    const closeModal = () => {
        setConfirmOpen(false);
        setPassword('');
        setConfirmEmail('');
    };

    const submitReset = async () => {
        try {
            const res = await resetDatabase({ password, confirmEmail });
            toast.success(res?.message || 'Database reset complete.', {
                description: res?.data?.note || 'This deployment is now blank — visit /install to activate it again.',
                duration: 15000,
            });
            closeModal();
            logout();
        } catch {
            // Surfaced via `error` below — leave the modal open so they can retry.
        }
    };

    return (
        <>
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
                <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                        <AlertTriangle size={16} />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-rose-800">Start Fresh</p>
                        <p className="mt-0.5 text-xs text-rose-700">
                            Permanently deletes every employee, attendance, payroll, document and setting record, then
                            re-seeds a blank install with no admin account — the next visitor must go through /install again. This cannot be undone.
                        </p>
                    </div>
                    <CustomButton size="sm" variant="danger" icon={Trash2} iconPosition="left" onClick={() => setConfirmOpen(true)} className="shrink-0">
                        Start Fresh
                    </CustomButton>
                </div>
            </div>

            <CustomModal
                isOpen={confirmOpen}
                onClose={closeModal}
                title="Wipe the database?"
                size="md"
                showCloseButton
                footer={(
                    <div className="flex gap-3 border-t border-slate-100 pt-4">
                        <CustomButton onClick={closeModal} disabled={isResetting}
                            className="flex-1 border border-slate-200 bg-white! text-slate-700! hover:bg-slate-100!">Cancel</CustomButton>
                        <CustomButton variant="danger" icon={Trash2} iconPosition="left" isLoading={isResetting}
                            disabled={!password || !confirmEmail} onClick={submitReset} className="flex-1">
                            Wipe everything
                        </CustomButton>
                    </div>
                )}
            >
                <div className="space-y-4 px-1">
                    <p className="text-sm text-slate-600">
                        This deletes every record in the database — employees, attendance, payroll, documents,
                        settings, roles, and the admin account itself — leaving a blank install with nobody able to
                        sign in until someone completes /install again. You will be signed out immediately.
                    </p>

                    {error && (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>
                    )}

                    <CustomInput
                        label="Your password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        isRequired
                        placeholder="Re-enter your password"
                    />
                    <CustomInput
                        label="Type your account email to confirm"
                        type="email"
                        value={confirmEmail}
                        onChange={(e) => setConfirmEmail(e.target.value)}
                        isRequired
                        placeholder="you@example.com"
                    />
                </div>
            </CustomModal>
        </>
    );
}

function SetupWizard() {
    const navigate = useNavigate();
    const { data, isLoading } = useSetupStatus();
    const { completed, steps, resetAllowed } = data;

    if (isLoading) {
        return <Loading size="lg" text="Loading setup status" fullPage />;
    }

    const requiredSteps = steps.filter((s) => s.required);
    const doneCount = requiredSteps.filter((s) => s.done).length;

    return (
        <div className="mx-auto max-w-3xl space-y-6 pb-10">
            <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Sparkles size={20} />
                </div>
                <div>
                    <h1 className="text-lg font-bold text-slate-900">Getting Started</h1>
                    <p className="text-sm text-slate-500">
                        {requiredSteps.length > 0
                            ? `${doneCount} of ${requiredSteps.length} required steps complete.`
                            : 'No required steps configured.'}
                    </p>
                </div>
            </div>

            {completed && (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <PartyPopper size={20} className="shrink-0 text-emerald-600" />
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-emerald-800">You're all set!</p>
                        <p className="text-xs text-emerald-700">Every required step is done — head to the dashboard whenever you're ready.</p>
                    </div>
                    <CustomButton size="sm" variant="primary" onClick={() => navigate('/dashboard')}>
                        Go to Dashboard
                    </CustomButton>
                </div>
            )}

            <div className="space-y-3">
                {steps.map((step) => (
                    <StepCard key={step.key} step={step} />
                ))}
            </div>

            <WizardToggle />
            <DangerZone resetAllowed={resetAllowed} />
        </div>
    );
}

export default SetupWizard;
