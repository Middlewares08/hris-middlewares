import { useState, useEffect, useCallback } from 'react';
import { faceEnrollmentService } from '../services/faceEnrollmentServices';
import { toast } from 'sonner';

/**
 * Manages a single employee's face-recognition enrollment.
 * @param {number|string|null} employeeId
 */
export function useFaceEnrollment(employeeId = null) {
    const [enrollment, setEnrollment] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const refresh = useCallback(async () => {
        if (!employeeId) return;
        setLoading(true);
        setError(null);
        try {
            const result = await faceEnrollmentService.getByEmployeeId(employeeId);
            if (result.success) setEnrollment(result.data || null);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Failed to load face enrollment.');
        } finally {
            setLoading(false);
        }
    }, [employeeId]);

    useEffect(() => {
        let mounted = true;
        (async () => {
            if (mounted) await refresh();
        })();
        return () => {
            mounted = false;
        };
    }, [refresh]);

    /**
     * @param {{ blob: Blob, consent: boolean }} args
     */
    const enroll = async ({ blob, consent }) => {
        setSaving(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('employee_id', String(employeeId));
            formData.append('consent', consent ? 'true' : 'false');
            formData.append('image', blob, 'face.jpg');

            const result = await faceEnrollmentService.enroll(formData);
            if (result.success) {
                toast.success('Face enrolled successfully.');
                setEnrollment(result.data);
                return result.data;
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'Face enrollment failed.';
            toast.error(msg);
            setError(msg);
            throw new Error(msg, { cause: err });
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        setSaving(true);
        setError(null);
        try {
            const result = await faceEnrollmentService.remove(employeeId);
            if (result.success) {
                toast.success('Face enrollment removed.');
                setEnrollment(null);
                return result;
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to remove enrollment.';
            toast.error(msg);
            setError(msg);
            throw new Error(msg, { cause: err });
        } finally {
            setSaving(false);
        }
    };

    return { enrollment, loading, saving, error, refresh, enroll, remove };
}
