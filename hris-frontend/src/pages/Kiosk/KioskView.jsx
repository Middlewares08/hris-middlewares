import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import {
    ScanFace,
    Clock,
    CheckCircle2,
    LogOut,
    AlertTriangle,
    Maximize2,
    CalendarCheck,
} from 'lucide-react';
import Loading from '../../components/Loading';
import CustomForm from '../../components/CustomForm';
import { kioskDeviceService } from '../../services/kioskServices';
import { kioskTokenValidationSchema } from '../../validation/kiosk-token-validation';

const FaceLivenessCheck = lazy(() => import('../../components/kiosk/FaceLivenessCheck'));

// Auto-start the liveness check once a steady face has been in frame this long.
const FACE_STABLE_MS = 1200;
const DETECT_INTERVAL_MS = 350;
// After a result, ignore the camera for a bit so the person can walk away.
const COOLDOWN_MS = 12000;
const RESULT_MS = 6500;
const ERROR_MS = 5000;

function useClock() {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);
    return now;
}

const fmtTime = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const fmtClock = (d) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fmtDate = (d) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

export default function KioskView() {
    // phase: loading | needsToken | disabled | idle | verifying | result
    const [phase, setPhase] = useState(() =>
        localStorage.getItem('kioskToken') ? 'loading' : 'needsToken',
    );
    const [kioskName, setKioskName] = useState('');
    const [fatal, setFatal] = useState(null); // message on needsToken / disabled
    const [result, setResult] = useState(null); // { kind:'in'|'out'|'none'|'error', employee?, time?, message }

    const now = useClock();
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const cooldownUntilRef = useRef(0);
    const phaseRef = useRef(phase);
    useEffect(() => {
        phaseRef.current = phase;
    }, [phase]);

    /* ---------------- config / token ---------------- */

    const loadConfig = useCallback(async () => {
        setPhase('loading');
        try {
            const res = await kioskDeviceService.getConfig();
            const cfg = res?.data || {};
            setKioskName(cfg.name || '');
            if (!cfg.ready) {
                setFatal('This kiosk is not fully configured yet. Contact IT.');
                setPhase('disabled');
                return;
            }
            if (!cfg.kioskEnabled) {
                setFatal('The attendance kiosk is currently switched off.');
                setPhase('disabled');
                return;
            }
            setPhase('idle');
        } catch (err) {
            const code = err?.response?.data?.code;
            if (err?.response?.status === 401 || code === 'KIOSK_UNAUTHORIZED') {
                localStorage.removeItem('kioskToken');
                setFatal('This device is not registered (or was revoked). Enter a kiosk token.');
                setPhase('needsToken');
                return;
            }
            setFatal('Could not reach the server. Tap Retry.');
            setPhase('disabled');
        }
    }, []);

    useEffect(() => {
        if (localStorage.getItem('kioskToken')) loadConfig();
    }, [loadConfig]);

    const submitToken = async ({ token }) => {
        const t = token.trim();
        if (!t) return;
        localStorage.setItem('kioskToken', t);
        await loadConfig();
    };

    /* ---------------- idle camera + face presence ---------------- */

    const stopStream = useCallback(() => {
        streamRef.current?.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
    }, []);

    const startStream = useCallback(async () => {
        if (streamRef.current || !navigator.mediaDevices?.getUserMedia) return;
        try {
            const s = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
            });
            streamRef.current = s;
            if (videoRef.current) videoRef.current.srcObject = s;
        } catch {
            /* no camera / denied — the button still works */
        }
    }, []);

    const beginVerify = useCallback(() => {
        stopStream();
        setPhase('verifying');
    }, [stopStream]);

    const cooldownToIdle = useCallback((ms) => {
        cooldownUntilRef.current = Date.now() + COOLDOWN_MS;
        setTimeout(() => {
            setResult(null);
            setPhase('idle');
        }, ms);
    }, []);

    // Run the preview + FaceDetector loop only while idle.
    useEffect(() => {
        if (phase !== 'idle') return undefined;
        let cancelled = false;
        let timer;
        let faceSince = 0;
        let detector = null;

        startStream();
        if (typeof window !== 'undefined' && 'FaceDetector' in window) {
            try {
                detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
            } catch {
                detector = null;
            }
        }
        if (!detector) return () => { cancelled = true; };

        const tick = async () => {
            if (cancelled || phaseRef.current !== 'idle') return;
            const video = videoRef.current;
            const past = Date.now() < cooldownUntilRef.current;
            if (video?.videoWidth && !past) {
                let faces = [];
                try {
                    faces = await detector.detect(video);
                } catch {
                    detector = null;
                }
                if (faces.length === 1) {
                    if (!faceSince) faceSince = Date.now();
                    if (Date.now() - faceSince >= FACE_STABLE_MS) {
                        beginVerify();
                        return;
                    }
                } else {
                    faceSince = 0;
                }
            } else {
                faceSince = 0;
            }
            timer = setTimeout(tick, DETECT_INTERVAL_MS);
        };
        timer = setTimeout(tick, DETECT_INTERVAL_MS);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [phase, startStream, beginVerify]);

    useEffect(() => stopStream, [stopStream]);

    /* ---------------- verify + punch ---------------- */

    const handleComplete = useCallback(
        async (sessionId) => {
            try {
                const res = await kioskDeviceService.punch(sessionId);
                if (res?.success) {
                    const d = res.data;
                    setResult({
                        kind: d.action, // 'in' | 'out' | 'none'
                        employee: d.employee,
                        time: d.time,
                        message: d.message,
                    });
                    setPhase('result');
                    cooldownToIdle(RESULT_MS);
                } else {
                    setResult({ kind: 'error', message: res?.message || 'Verification failed. Please try again.' });
                    setPhase('result');
                    cooldownToIdle(ERROR_MS);
                }
            } catch (err) {
                const code = err?.response?.data?.code;
                if (err?.response?.status === 401 || code === 'KIOSK_UNAUTHORIZED') {
                    localStorage.removeItem('kioskToken');
                    setFatal('This device was deactivated. Enter a new kiosk token.');
                    setPhase('needsToken');
                    return;
                }
                setResult({
                    kind: 'error',
                    message: err?.response?.data?.message || 'Could not reach the server. Try again.',
                });
                setPhase('result');
                cooldownToIdle(ERROR_MS);
            }
        },
        [cooldownToIdle],
    );

    const handleLivenessError = useCallback(() => {
        setResult({ kind: 'error', message: 'Verification could not run. Step back and try again.' });
        setPhase('result');
        cooldownToIdle(ERROR_MS);
    }, [cooldownToIdle]);

    const goFullscreen = () => {
        document.documentElement.requestFullscreen?.().catch(() => {});
    };

    /* ---------------- render ---------------- */

    const shell = (children) => (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 text-white overflow-hidden">
            <button
                type="button"
                onClick={goFullscreen}
                className="absolute right-4 top-4 rounded-lg bg-white/10 p-2 text-white/60 hover:bg-white/20 hover:text-white"
                title="Fullscreen"
            >
                <Maximize2 size={16} />
            </button>
            {children}
        </div>
    );

    if (phase === 'loading') {
        return shell(<Loading size="lg" text="Starting kiosk" color="slate" />);
    }

    if (phase === 'needsToken') {
        return shell(
            <div className="w-full max-w-sm px-6 text-center">
                <ScanFace size={40} className="mx-auto mb-4 text-indigo-400" />
                <h1 className="text-xl font-semibold">Attendance Kiosk</h1>
                <p className="mt-2 text-sm text-white/60">
                    {fatal || 'Paste the kiosk token from HR to activate this device.'}
                </p>
                <CustomForm
                    initialValues={{ token: '' }}
                    validationSchema={kioskTokenValidationSchema}
                    onSubmit={submitToken}
                    id="kiosk-token-form"
                    content={(errors, touched, handleSubmit, values, setFieldValue) => (
                        <>
                            <input
                                autoFocus
                                value={values.token}
                                onChange={(e) => setFieldValue('token', e.target.value)}
                                placeholder="Kiosk token"
                                className="mt-5 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-center text-sm tracking-wide text-white placeholder-white/30 focus:border-indigo-400 focus:outline-none"
                            />
                            {errors.token && touched.token && (
                                <p className="mt-1.5 text-xs font-medium text-amber-400">{errors.token}</p>
                            )}
                            <button
                                type="submit"
                                className="mt-3 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold hover:bg-indigo-500"
                            >
                                Activate
                            </button>
                        </>
                    )}
                />
            </div>,
        );
    }

    if (phase === 'disabled') {
        return shell(
            <div className="max-w-md px-6 text-center">
                <AlertTriangle size={40} className="mx-auto mb-4 text-amber-400" />
                <h1 className="text-xl font-semibold">Kiosk unavailable</h1>
                <p className="mt-2 text-sm text-white/60">{fatal}</p>
                <button
                    type="button"
                    onClick={loadConfig}
                    className="mt-5 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
                >
                    Retry
                </button>
            </div>,
        );
    }

    if (phase === 'verifying') {
        return shell(
            <div className="w-full max-w-md px-4">
                <p className="mb-3 text-center text-sm font-medium text-white/70">
                    Follow the on-screen prompts to verify your identity
                </p>
                <Suspense fallback={<div className="flex h-72 items-center justify-center"><Loading text="Preparing camera" color="slate" /></div>}>
                    <FaceLivenessCheck
                        onComplete={handleComplete}
                        onError={handleLivenessError}
                        onCancel={() => { setPhase('idle'); }}
                    />
                </Suspense>
            </div>,
        );
    }

    if (phase === 'result' && result) {
        const map = {
            in: { icon: CheckCircle2, tint: 'text-emerald-400', ring: 'ring-emerald-500/30', label: 'Clocked In' },
            out: { icon: LogOut, tint: 'text-sky-400', ring: 'ring-sky-500/30', label: 'Clocked Out' },
            none: { icon: CalendarCheck, tint: 'text-slate-300', ring: 'ring-slate-500/30', label: 'Already Done' },
            error: { icon: AlertTriangle, tint: 'text-amber-400', ring: 'ring-amber-500/30', label: 'Try Again' },
        };
        const r = map[result.kind] || map.error;
        const Icon = r.icon;
        const emp = result.employee;
        return shell(
            <div className="flex flex-col items-center px-6 text-center">
                {emp?.photo_url ? (
                    <img
                        src={emp.photo_url}
                        alt=""
                        className={`h-28 w-28 rounded-full object-cover ring-4 ${r.ring}`}
                    />
                ) : (
                    <div className={`flex h-28 w-28 items-center justify-center rounded-full bg-white/5 ring-4 ${r.ring}`}>
                        <Icon size={44} className={r.tint} />
                    </div>
                )}

                {emp && (
                    <>
                        <p className="mt-5 text-3xl font-semibold">{emp.name}</p>
                        {(emp.position || emp.department) && (
                            <p className="mt-1 text-sm text-white/50">
                                {[emp.position, emp.department].filter(Boolean).join(' · ')}
                            </p>
                        )}
                    </>
                )}

                <div className={`mt-6 inline-flex items-center gap-2 text-lg font-medium ${r.tint}`}>
                    <Icon size={20} />
                    {r.label}
                    {result.time && result.kind !== 'error' && (
                        <span className="text-white/70">· {fmtTime(new Date(result.time))}</span>
                    )}
                </div>
                {result.message && <p className="mt-2 text-sm text-white/50">{result.message}</p>}
            </div>,
        );
    }

    // ---- idle ----
    return shell(
        <div className="flex w-full max-w-4xl flex-col items-center px-6">
            <div className="text-center">
                <p className="font-mono text-6xl font-bold tracking-tight sm:text-7xl">{fmtClock(now)}</p>
                <p className="mt-1 text-sm text-white/50">{fmtDate(now)}</p>
                {kioskName && <p className="mt-1 text-xs uppercase tracking-widest text-white/30">{kioskName}</p>}
            </div>

            <div className="relative mt-8 aspect-4/3 w-full max-w-md overflow-hidden rounded-3xl bg-black ring-1 ring-white/10">
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 flex items-end justify-center p-4">
                    <span className="rounded-full bg-black/50 px-4 py-1.5 text-sm font-medium text-white/80">
                        Look at the camera to clock in / out
                    </span>
                </div>
            </div>

            <button
                type="button"
                onClick={beginVerify}
                className="mt-8 inline-flex items-center gap-3 rounded-2xl bg-indigo-600 px-10 py-4 text-lg font-semibold shadow-lg shadow-indigo-900/40 hover:bg-indigo-500"
            >
                <Clock size={22} />
                Clock In / Out
            </button>
            <p className="mt-3 text-xs text-white/30">Your face is verified live and matched to your HR profile.</p>
        </div>,
    );
}
