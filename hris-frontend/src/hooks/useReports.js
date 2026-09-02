import { useQuery } from '@tanstack/react-query';
import { reportService } from '../services/reportServices';

const errMsg = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

/**
 * Generic reader for a single HR report. Mirrors `useDashboardAnalytics`.
 *
 * @param {string} key    report key (headcount, attendance, ...)
 * @param {object} params { dateFrom, dateTo }
 * @param {boolean} enabled
 */
export function useReport(key, params = {}, enabled = true) {
    const query = useQuery({
        queryKey: ['report', key, params],
        queryFn: () => reportService.get(key, params),
        staleTime: 60_000,
        enabled: enabled && !!key,
        keepPreviousData: true,
    });

    return {
        data: query.data?.data || null,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        error: query.isError ? errMsg(query.error, 'Failed to load the report.') : null,
        refetch: query.refetch,
    };
}
