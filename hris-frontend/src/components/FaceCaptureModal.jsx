import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, Camera, Check, RefreshCw, Upload } from 'lucide-react';
import CustomModal from './CustomModal';
import CustomButton from './CustomButton';

const MAX_DIM = 1024; // longest edge of the saved image
const ACCEPTED = /^image\/(jpe?g|png|webp)$/i;

/** Draw a source (video frame or bitmap) onto a downscaled JPEG blob. */
function drawToBlob(source, srcW, srcH) {
    const scale = Math.min(1, MAX_DIM / Math.max(srcW, srcH));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(srcW * scale);
    canvas.height = Math.round(srcH * scale);
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
}

async function fileToBlob(file) {
    const bitmap = await createImageBitmap(file);
    try {
        return await drawToBlob(bitmap, bitmap.width, bitmap.height);
    } finally {
        bitmap.close?.();
    }
}

/**
 * Mount this component only while it should be visible (`{open && <FaceCaptureModal .../>}`)
 * so each session starts with a fresh camera + clean state.
 */
export default function FaceCaptureModal({ onClose, employeeName, onSubmit, saving }) {
    const [mode, setMode] = useState('camera'); // 'camera' | 'upload'
    const [stream, setStream] = useState(null);
    const [notice, setNotice] = useState(null);
    const [preview, setPreview] = useState(null); // { url, blob }
    const [consent, setConsent] = useState(false);
    const videoRef = useRef(null);

    const stopStream = useCallback(() => {
        setStream((current) => {
            current?.getTracks().forEach((t) => t.stop());
            return null;
        });
    }, []);

    const startCamera = useCallback(async () => {
        // Defer a tick so state updates never land synchronously inside an effect.
        await Promise.resolve();
        setNotice(null);
        if (!navigator.mediaDevices?.getUserMedia) {
            setNotice('This browser/context has no camera access (needs HTTPS). Use Upload instead.');
            setMode('upload');
            return;
        }
        try {
            const s = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
            });
            setStream(s);
        } catch (err) {
            setNotice(
                err?.name === 'NotAllowedError'
                    ? 'Camera permission was denied. Allow it and retry, or use Upload.'
                    : 'No camera available. Use the Upload option instead.',
            );
            setMode('upload');
        }
    }, []);

    // Start the camera on mount; tear the stream down on unmount.
    useEffect(() => {
        let active = true;
        const run = async () => {
            if (active) await startCamera();
        };
        run();
        return () => {
            active = false;
            stopStream();
        };
    }, [startCamera, stopStream]);

    // Bind the active stream to the <video> element
    useEffect(() => {
        if (stream && videoRef.current) videoRef.current.srcObject = stream;
    }, [stream, preview, mode]);

    const capture = async () => {
        const video = videoRef.current;
        if (!video?.videoWidth) return;
        const blob = await drawToBlob(video, video.videoWidth, video.videoHeight);
        stopStream();
        setPreview({ url: URL.createObjectURL(blob), blob });
    };

    const onPickFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!ACCEPTED.test(file.type)) {
            setNotice('Please choose a JPEG, PNG or WebP image.');
            return;
        }
        setNotice(null);
        const blob = await fileToBlob(file);
        setPreview({ url: URL.createObjectURL(blob), blob });
    };

    const retake = () => {
        setPreview((p) => {
            if (p?.url) URL.revokeObjectURL(p.url);
            return null;
        });
        if (mode === 'camera') startCamera();
    };

    const switchMode = (next) => {
        if (next === mode) return;
        setNotice(null);
        if (next === 'upload') stopStream();
        setMode(next);
        if (next === 'camera' && !preview) startCamera();
    };

    const submit = () => {
        if (preview?.blob && consent) onSubmit({ blob: preview.blob, consent });
    };

    return (
        <CustomModal
            isOpen
            onClose={onClose}
            title={`Register Face${employeeName ? ` — ${employeeName}` : ''}`}
            size="md"
            showCloseButton
            footer={
                <>
                    <CustomButton
                        size="sm"
                        onClick={onClose}
                        className="w-auto! px-4 bg-white! text-slate-600! border border-slate-200 hover:bg-slate-50!"
                    >
                        Cancel
                    </CustomButton>
                    <CustomButton
                        size="sm"
                        onClick={submit}
                        disabled={!preview || !consent}
                        isLoading={saving}
                        icon={Check}
                        iconPosition="left"
                        className="w-auto! px-5"
                    >
                        Save Enrollment
                    </CustomButton>
                </>
            }
        >
            <div className="space-y-4">
                {!preview && (
                    <div className="flex gap-2">
                        {[
                            { key: 'camera', label: 'Camera', Icon: Camera },
                            { key: 'upload', label: 'Upload', Icon: Upload },
                        ].map(({ key, label, Icon }) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => switchMode(key)}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                    mode === key
                                        ? 'bg-slate-900 text-white border-slate-900'
                                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <Icon size={16} /> {label}
                            </button>
                        ))}
                    </div>
                )}

                {notice && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        <span>{notice}</span>
                    </div>
                )}

                <div className="relative aspect-4/3 bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center">
                    {preview ? (
                        <img src={preview.url} alt="Face preview" className="w-full h-full object-cover" />
                    ) : mode === 'camera' ? (
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    ) : (
                        <label className="flex flex-col items-center gap-2 text-slate-300 cursor-pointer text-sm p-6 text-center">
                            <Upload size={28} />
                            <span>Choose a JPEG, PNG or WebP image</span>
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={onPickFile}
                            />
                        </label>
                    )}
                </div>

                <div className="flex justify-center">
                    {preview ? (
                        <CustomButton
                            size="sm"
                            onClick={retake}
                            icon={RefreshCw}
                            iconPosition="left"
                            className="w-auto! px-4 bg-white! text-slate-600! border border-slate-200 hover:bg-slate-50!"
                        >
                            Retake
                        </CustomButton>
                    ) : mode === 'camera' && stream ? (
                        <CustomButton
                            size="sm"
                            onClick={capture}
                            icon={Camera}
                            iconPosition="left"
                            className="w-auto! px-6"
                        >
                            Capture
                        </CustomButton>
                    ) : null}
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                    Use a well-lit, front-facing photo with only this employee in frame. AWS Rekognition
                    checks the image for a single clear face before it is saved.
                </p>

                <label className="flex items-start gap-2 text-xs text-slate-700">
                    <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        className="mt-0.5"
                    />
                    <span>
                        The employee has consented to enrolling their facial biometric for time &amp;
                        attendance verification, in line with the company privacy policy.
                    </span>
                </label>
            </div>
        </CustomModal>
    );
}

FaceCaptureModal.propTypes = {
    onClose: PropTypes.func.isRequired,
    employeeName: PropTypes.string,
    onSubmit: PropTypes.func.isRequired,
    saving: PropTypes.bool,
};
