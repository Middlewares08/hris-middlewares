import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { workScheduleService } from '../services/workScheduleServices';

const errMsg = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

/**
 * Admin CRUD for work schedules (weekly shift patterns). Mutations invalidate the
 * schedule list plus anything that reads a resolved schedule (attendance,
 * reports, dashboard).
 */
export function useWorkSchedules(params = {}) {
    const qc = useQueryClient();
    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ['workSchedules'] });
        qc.invalidateQueries({ queryKey: ['attendanceLogs'] });
        qc.invalidateQueries({ queryKey: ['report'] });
        qc.invalidateQueries({ queryKey: ['dashboardAnalytics'] });
    };

    const query = useQuery({
        queryKey: ['workSchedules', params],
        queryFn: () => workScheduleService.getAll(params),
        keepPreviousData: true,
    });

    const createMutation = useMutation({
        mutationFn: (payload) => workScheduleService.create(payload),
        onSuccess: (res) => { toast.success(res?.message || 'Work schedule created.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to create work schedule.')),
    });

    const updateMutation = useMutation({
        mutationFn: ({ uuid, payload }) => workScheduleService.update(uuid, payload),
        onSuccess: (res) => { toast.success(res?.message || 'Work schedule updated.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to update work schedule.')),
    });

    const removeMutation = useMutation({
        mutationFn: (uuid) => workScheduleService.remove(uuid),
        onSuccess: (res) => { toast.success(res?.message || 'Work schedule archived.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to archive work schedule.')),
    });

    return {
        items: query.data?.data || [],
        pagination: query.data?.pagination || null,
        isLoading: query.isLoading,
        error: query.isError ? errMsg(query.error, 'Failed to load work schedules.') : null,
        refetch: query.refetch,
        create: createMutation.mutateAsync,
        update: updateMutation.mutateAsync,
        remove: removeMutation.mutateAsync,
        isMutating: createMutation.isPending || updateMutation.isPending || removeMutation.isPending,
    };
}

/** Un-paginated active schedules — for assignment pickers / dropdowns. */
export function useWorkScheduleOptions(enabled = true) {
    const query = useQuery({
        queryKey: ['workSchedules', 'options'],
        queryFn: () => workScheduleService.listAll(),
        enabled,
        staleTime: 60_000,
    });
    return { options: query.data?.data || [], isLoading: query.isLoading };
}

/** One employee's current schedule + assignment history. */
export function useEmployeeSchedule(employeeId) {
    const qc = useQueryClient();
    const query = useQuery({
        queryKey: ['employeeSchedule', employeeId],
        queryFn: () => workScheduleService.employeeAssignments(employeeId),
        enabled: !!employeeId,
    });

    const assignMutation = useMutation({
        mutationFn: (payload) => workScheduleService.assign({ employee_id: employeeId, ...payload }),
        onSuccess: (res) => {
            toast.success(res?.message || 'Schedule assigned.');
            qc.invalidateQueries({ queryKey: ['employeeSchedule', employeeId] });
            qc.invalidateQueries({ queryKey: ['employees'] });
            qc.invalidateQueries({ queryKey: ['attendanceLogs'] });
        },
        onError: (err) => toast.error(errMsg(err, 'Failed to assign schedule.')),
    });

    return {
        current: query.data?.data?.current || null,
        history: query.data?.data?.history || [],
        isLoading: query.isLoading,
        assign: assignMutation.mutateAsync,
        isAssigning: assignMutation.isPending,
    };
}
