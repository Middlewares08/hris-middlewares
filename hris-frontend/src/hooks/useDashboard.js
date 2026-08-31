import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardServices';

const errMsg = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

/**
 * Admin dashboard analytics — a single aggregate payload (KPIs + chart series).
 * Cheap to keep fresh; refetched on window focus with a short stale window.
 */
export function useDashboardAnalytics(params = {}, enabled = true) {
    const query = useQuery({
        queryKey: ['dashboardAnalytics', params],
        queryFn: () => dashboardService.getAnalytics(params),
        staleTime: 60_000,
        enabled,
    });

    return {
        data: query.data?.data || null,
        isLoading: query.isLoading,
        error: query.isError ? errMsg(query.error, 'Failed to load dashboard analytics.') : null,
        refetch: query.refetch,
        isFetching: query.isFetching,
    };
}
