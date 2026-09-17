import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { systemService } from '../services/systemServices';

const errMsg = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

/**
 * Application settings / feature flags. `values` is a flat { key: value } map.
 */
export function useSettings() {
    const qc = useQueryClient();

    const query = useQuery({
        queryKey: ['systemSettings'],
        queryFn: systemService.getSettings,
        select: (res) => res?.data || { values: {}, rows: [] },
    });

    const updateMutation = useMutation({
        mutationFn: ({ key, value }) => systemService.updateSetting(key, value),
        onSuccess: (res) => {
            toast.success(res?.message || 'Setting saved.');
            qc.invalidateQueries({ queryKey: ['systemSettings'] });
        },
        onError: (err) => toast.error(errMsg(err, 'Failed to save setting.')),
    });

    return {
        values: query.data?.values || {},
        rows: query.data?.rows || [],
        isLoading: query.isLoading,
        error: query.isError ? errMsg(query.error, 'Failed to load settings.') : null,
        updateSetting: updateMutation.mutateAsync,
        isSaving: updateMutation.isPending,
    };
}
