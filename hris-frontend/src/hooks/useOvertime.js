import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { overtimeService } from '../services/overtimeServices';

const errMsg = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

/**
 * Admin list + review/delete hook for overtime requests.
 * List is fetched with a generous limit and paginated client-side by CustomDataTable.
 */
export function useOvertimeRequests(params = {}) {
    const qc = useQueryClient();
    const invalidate = () => qc.invalidateQueries({ queryKey: ['overtimeRequests'] });

    const query = useQuery({
        queryKey: ['overtimeRequests', params],
        queryFn: () => overtimeService.getAll({ limit: 200, ...params }),
        keepPreviousData: true,
    });

    const reviewMutation = useMutation({
        mutationFn: ({ uuid, decision, remarks }) => overtimeService.review(uuid, decision, remarks),
        onSuccess: (res) => { toast.success(res?.message || 'Overtime request reviewed.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to review request.')),
    });

    const removeMutation = useMutation({
        mutationFn: (uuid) => overtimeService.remove(uuid),
        onSuccess: (res) => { toast.success(res?.message || 'Overtime request archived.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to archive request.')),
    });

    const createMutation = useMutation({
        mutationFn: (payload) => overtimeService.create(payload),
        onSuccess: (res) => { toast.success(res?.message || 'Overtime request filed.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to file request.')),
    });

    return {
        items: query.data?.data || [],
        pagination: query.data?.pagination || null,
        isLoading: query.isLoading,
        error: query.isError ? errMsg(query.error, 'Failed to load overtime requests.') : null,
        refetch: query.refetch,
        review: reviewMutation.mutateAsync,
        remove: removeMutation.mutateAsync,
        create: createMutation.mutateAsync,
        isMutating: reviewMutation.isPending || removeMutation.isPending || createMutation.isPending,
    };
}
