import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { attendanceService } from '../services/attendanceServices';

const errMsg = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

/**
 * Admin list + manual entry / edit / archive hook for the daily attendance log.
 * List is server-side paginated — pass { page, limit, search, status, employee_id, date_from, date_to }.
 */
export function useAttendanceLogs(params = {}) {
    const qc = useQueryClient();
    const invalidate = () => qc.invalidateQueries({ queryKey: ['attendanceLogs'] });

    const query = useQuery({
        queryKey: ['attendanceLogs', params],
        queryFn: () => attendanceService.getAll(params),
        keepPreviousData: true,
    });

    const createMutation = useMutation({
        mutationFn: (payload) => attendanceService.create(payload),
        onSuccess: (res) => { toast.success(res?.message || 'Attendance recorded.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to record attendance.')),
    });

    const updateMutation = useMutation({
        mutationFn: ({ uuid, payload }) => attendanceService.update(uuid, payload),
        onSuccess: (res) => { toast.success(res?.message || 'Attendance updated.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to update attendance.')),
    });

    const removeMutation = useMutation({
        mutationFn: (uuid) => attendanceService.remove(uuid),
        onSuccess: (res) => { toast.success(res?.message || 'Attendance archived.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to archive attendance.')),
    });

    const pagination = query.data?.pagination || null;

    return {
        items: query.data?.data || [],
        pagination,
        totalRecords: pagination?.totalRecords || 0,
        isLoading: query.isLoading,
        error: query.isError ? errMsg(query.error, 'Failed to load attendance logs.') : null,
        refetch: query.refetch,
        create: createMutation.mutateAsync,
        update: updateMutation.mutateAsync,
        remove: removeMutation.mutateAsync,
        isMutating: createMutation.isPending || updateMutation.isPending || removeMutation.isPending,
    };
}
