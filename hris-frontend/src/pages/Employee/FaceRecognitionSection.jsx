import { useState } from 'react';
import PropTypes from 'prop-types';
import { Camera, ScanFace, Trash2 } from 'lucide-react';
import CustomButton from '../../components/CustomButton';
import FaceCaptureModal from '../../components/FaceCaptureModal';
import { useFaceEnrollment } from '../../hooks/useFaceEnrollment';
import { can } from '../../utils/permissionCheck';

/**
 * "Face Recognition" block inside the employee detail drawer — shows enrollment
 * status and lets HR register / re-capture / remove an employee's reference face.
 */
export default function FaceRecognitionSection({ employee }) {
    const employeeId = employee?.id;
    const { enrollment, loading, saving, enroll, remove } = useFaceEnrollment(employeeId);
    const [modalOpen, setModalOpen] = useState(false);

    if (!can(['face-recognition:view', 'face-recognition:create'])) return null;

    const canEnroll = can('face-recognition:create');
    const canRemove = can('face-recognition:delete');

    const handleSubmit = async ({ blob, consent }) => {
        await enroll({ blob, consent });
        setModalOpen(false);
    };

    const handleRemove = async () => {
        if (window.confirm("Remove this employee's face enrollment?")) {
            await remove();
        }
    };

    return (
        <>
            <div className="space-y-3">
                <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <ScanFace size={14} /> Face Recognition
                </h5>

                {loading ? (
                    <div className="h-16 bg-slate-50 rounded-xl animate-pulse" />
                ) : enrollment ? (
                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl p-3">
                        <img
                            src={enrollment.image_url}
                            alt="Enrolled face"
                            className="w-12 h-12 rounded-lg object-cover bg-slate-200 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-emerald-700">Enrolled</p>
                            <p className="text-xs text-slate-400 truncate">
                                {enrollment.consent_at
                                    ? new Date(enrollment.consent_at).toLocaleDateString()
                                    : ''}
                                {enrollment.detect_confidence
                                    ? ` · ${Number(enrollment.detect_confidence).toFixed(0)}% quality`
                                    : ''}
                            </p>
                        </div>
                        {canEnroll && (
                            <button
                                type="button"
                                onClick={() => setModalOpen(true)}
                                title="Re-capture"
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <Camera size={16} />
                            </button>
                        )}
                        {canRemove && (
                            <button
                                type="button"
                                onClick={handleRemove}
                                title="Remove enrollment"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-100 rounded-xl p-3">
                        <div>
                            <p className="text-sm font-medium text-slate-600">Not enrolled</p>
                            <p className="text-xs text-slate-400">No face on file for clock-in verification.</p>
                        </div>
                        {canEnroll && (
                            <CustomButton
                                size="sm"
                                onClick={() => setModalOpen(true)}
                                icon={ScanFace}
                                iconPosition="left"
                                className="w-auto! px-3 shrink-0"
                            >
                                Register Face
                            </CustomButton>
                        )}
                    </div>
                )}
            </div>

            {modalOpen && (
                <FaceCaptureModal
                    onClose={() => setModalOpen(false)}
                    employeeName={`${employee?.first_name || ''} ${employee?.last_name || ''}`.trim()}
                    onSubmit={handleSubmit}
                    saving={saving}
                />
            )}
        </>
    );
}

FaceRecognitionSection.propTypes = {
    employee: PropTypes.object,
};
