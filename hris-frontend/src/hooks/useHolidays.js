import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { holidayService } from '../services/holidayServices';

const errMsg = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

/**
 * Admin CRUD for the holiday calendar. Absence math + report denominators read
 * this, so mutations invalidate reports / dashboard / attendance too.
 */
export function useHolidays(params = {}) {
    const qc = useQueryClient();
    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ['holidays'] });
        qc.invalidateQueries({ queryKey: ['attendanceLogs'] });
        qc.invalidateQueries({ queryKey: ['report'] });
        qc.invalidateQueries({ queryKey: ['dashboardAnalytics'] });
    };

    const query = useQuery({
        queryKey: ['holidays', params],
        queryFn: () => holidayService.getAll(params),
        keepPreviousData: true,
    });

    const createMutation = useMutation({
        mutationFn: (payload) => holidayService.create(payload),
        onSuccess: (res) => { toast.success(res?.message || 'Holiday added.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to add holiday.')),
    });

    const updateMutation = useMutation({
        mutationFn: ({ uuid, payload }) => holidayService.update(uuid, payload),
        onSuccess: (res) => { toast.success(res?.message || 'Holiday updated.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to update holiday.')),
    });

    const removeMutation = useMutation({
        mutationFn: (uuid) => holidayService.remove(uuid),
        onSuccess: (res) => { toast.success(res?.message || 'Holiday removed.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to remove holiday.')),
    });

    return {
        items: query.data?.data || [],
        isLoading: query.isLoading,
        error: query.isError ? errMsg(query.error, 'Failed to load holidays.') : null,
        refetch: query.refetch,
        create: createMutation.mutateAsync,
        update: updateMutation.mutateAsync,
        remove: removeMutation.mutateAsync,
        isMutating: createMutation.isPending || updateMutation.isPending || removeMutation.isPending,
    };
}
