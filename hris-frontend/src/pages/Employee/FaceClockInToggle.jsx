import { ScanFace, ShieldCheck } from 'lucide-react';
import { useSettings } from '../../hooks/useSystem';
import { can } from '../../utils/permissionCheck';

function Row({ icon: Icon, title, on, offText, onText, disabled, onToggle, hint }) {
    return (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${on ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Icon size={16} />
                </div>
                <div>
                    <p className="text-sm font-semibold text-slate-800">{title}</p>
                    <p className="text-xs text-slate-400">{on ? onText : offText}</p>
                </div>
            </div>
            <button
                type="button"
                disabled={disabled}
                onClick={onToggle}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}
                aria-pressed={on}
                title={hint}
            >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
        </div>
    );
}

/**
 * Master switches for face-verified clock-in/out and the optional liveness check.
 * Enrolled employees are affected; employees with no enrollment are not.
 */
export default function FaceClockInToggle() {
    const { values, isLoading, updateSetting, isSaving } = useSettings();
    const clockinOn = values['face.clockin_enabled'] === true;
    const livenessOn = values['face.liveness_enabled'] === true;
    const canEdit = can('face-recognition:edit');
    const busy = !canEdit || isLoading || isSaving;

    if (!can(['face-recognition:view', 'face-recognition:edit'])) return null;

    return (
        <div className="space-y-3">
            <Row
                icon={ScanFace}
                title="Face check on clock-in"
                on={clockinOn}
                onText="Enrolled employees must pass a face match to time in/out."
                offText="Clock-in/out runs without a face check."
                disabled={busy}
                onToggle={() => updateSetting({ key: 'face.clockin_enabled', value: !clockinOn })}
                hint={canEdit ? 'Toggle face check' : 'Requires face-recognition:edit'}
            />
            <Row
                icon={ShieldCheck}
                title="Liveness challenge"
                on={livenessOn && clockinOn}
                onText="Employees complete an active liveness check (anti-spoofing); a photo is the fallback."
                offText="Face check uses a single photo."
                disabled={busy || !clockinOn}
                onToggle={() => updateSetting({ key: 'face.liveness_enabled', value: !livenessOn })}
                hint={
                    !clockinOn
                        ? 'Turn on the face check first'
                        : canEdit
                          ? 'Toggle liveness challenge'
                          : 'Requires face-recognition:edit'
                }
            />
        </div>
    );
}
