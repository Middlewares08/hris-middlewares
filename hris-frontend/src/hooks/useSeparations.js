import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { separationService } from '../services/separationServices';

const errMsg = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

/**
 * Admin list + create/update/remove for employee separations.
 * Recording / removing a separation flips the employee's active flag, so the
 * employees + dashboard + report queries are invalidated too.
 */
export function useSeparations(params = {}) {
    const qc = useQueryClient();
    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ['separations'] });
        qc.invalidateQueries({ queryKey: ['employees'] });
        qc.invalidateQueries({ queryKey: ['report'] });
        qc.invalidateQueries({ queryKey: ['dashboardAnalytics'] });
    };

    const query = useQuery({
        queryKey: ['separations', params],
        queryFn: () => separationService.getAll(params),
        keepPreviousData: true,
    });

    const createMutation = useMutation({
        mutationFn: (payload) => separationService.create(payload),
        onSuccess: (res) => { toast.success(res?.message || 'Separation recorded.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to record separation.')),
    });

    const updateMutation = useMutation({
        mutationFn: ({ uuid, payload }) => separationService.update(uuid, payload),
        onSuccess: (res) => { toast.success(res?.message || 'Separation updated.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to update separation.')),
    });

    const removeMutation = useMutation({
        mutationFn: (uuid) => separationService.remove(uuid),
        onSuccess: (res) => { toast.success(res?.message || 'Separation removed.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to remove separation.')),
    });

    return {
        items: query.data?.data || [],
        isLoading: query.isLoading,
        error: query.isError ? errMsg(query.error, 'Failed to load separations.') : null,
        refetch: query.refetch,
        create: createMutation.mutateAsync,
        update: updateMutation.mutateAsync,
        remove: removeMutation.mutateAsync,
        isMutating: createMutation.isPending || updateMutation.isPending || removeMutation.isPending,
    };
}
