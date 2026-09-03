import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    payComponentService,
    statutoryTableService,
    compensationService,
    assignmentService,
    payPeriodService,
    payrollRunService,
    payslipService,
    payslipRequestService,
    employerProfileService,
} from '../services/payrollServices';
import { downloadBlob, filenameFromHeaders } from '../utils/downloadBlob';

const errMsg = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

// Fetches a payslip PDF and hands it to the browser as a download.
export async function downloadPayslipPdf(uuid) {
    try {
        const res = await payslipService.downloadPdf(uuid);
        downloadBlob(res.data, filenameFromHeaders(res.headers, `payslip-${uuid}.pdf`));
    } catch (err) {
        toast.error(errMsg(err, 'Failed to download payslip PDF.'));
    }
}

/**
 * Generic list + CRUD hook for a payroll resource.
 * Lists are fetched with a generous limit and paginated client-side by CustomDataTable.
 */
function useResource(key, service, params = {}) {
    const qc = useQueryClient();
    const invalidate = () => qc.invalidateQueries({ queryKey: [key] });

    const query = useQuery({
        queryKey: [key, params],
        queryFn: () => service.getAll({ limit: 200, ...params }),
        keepPreviousData: true,
    });

    const createMutation = useMutation({
        mutationFn: (payload) => service.create(payload),
        onSuccess: (res) => { toast.success(res?.message || 'Record created.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to create record.')),
    });

    const updateMutation = useMutation({
        mutationFn: ({ uuid, payload }) => service.update(uuid, payload),
        onSuccess: (res) => { toast.success(res?.message || 'Record updated.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to update record.')),
    });

    const removeMutation = useMutation({
        mutationFn: (uuid) => service.remove(uuid),
        onSuccess: (res) => { toast.success(res?.message || 'Record archived.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to archive record.')),
    });

    return {
        items: query.data?.data || [],
        pagination: query.data?.pagination || null,
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.isError ? errMsg(query.error, 'Failed to load data.') : null,
        refetch: query.refetch,
        create: createMutation.mutateAsync,
        update: updateMutation.mutateAsync,
        remove: removeMutation.mutateAsync,
        isMutating: createMutation.isPending || updateMutation.isPending || removeMutation.isPending,
    };
}

export const usePayComponents = (params) => useResource('payComponents', payComponentService, params);
export const useStatutoryTables = (params) => useResource('statutoryTables', statutoryTableService, params);
export const useCompensations = (params) => useResource('compensations', compensationService, params);
export const useComponentAssignments = (params) => useResource('componentAssignments', assignmentService, params);
export const usePayPeriods = (params) => useResource('payPeriods', payPeriodService, params);
export const usePayrollRuns = (params) => useResource('payrollRuns', payrollRunService, params);

/* ---- Payroll run: single record + lifecycle actions ---- */
export function usePayrollRun(uuid) {
    const qc = useQueryClient();
    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ['payrollRun', uuid] });
        qc.invalidateQueries({ queryKey: ['payrollRuns'] });
        qc.invalidateQueries({ queryKey: ['payslips'] });
        qc.invalidateQueries({ queryKey: ['runAdjustments', uuid] });
    };

    const query = useQuery({
        queryKey: ['payrollRun', uuid],
        queryFn: () => payrollRunService.getByUuid(uuid),
        select: (res) => res?.data || null,
        enabled: Boolean(uuid),
    });

    const actionOpts = (fallback) => ({
        onSuccess: (res) => { toast.success(res?.message || 'Done.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, fallback)),
    });

    const calculate = useMutation({ mutationFn: (payload = {}) => payrollRunService.calculate(uuid, payload), ...actionOpts('Calculation failed.') });
    const approve = useMutation({ mutationFn: () => payrollRunService.approve(uuid), ...actionOpts('Approval failed.') });
    const markPaid = useMutation({ mutationFn: (payload = {}) => payrollRunService.markPaid(uuid, payload), ...actionOpts('Failed to mark as paid.') });
    const cancel = useMutation({ mutationFn: () => payrollRunService.cancel(uuid), ...actionOpts('Failed to cancel run.') });

    return {
        run: query.data,
        isLoading: query.isLoading,
        error: query.isError ? errMsg(query.error, 'Failed to load run.') : null,
        refetch: query.refetch,
        calculate: calculate.mutateAsync,
        approve: approve.mutateAsync,
        markPaid: markPaid.mutateAsync,
        cancel: cancel.mutateAsync,
        isBusy: calculate.isPending || approve.isPending || markPaid.isPending || cancel.isPending,
    };
}

/* ---- Payslips within a run ---- */
export function usePayslips(params = {}) {
    const query = useQuery({
        queryKey: ['payslips', params],
        queryFn: () => payslipService.getAll({ limit: 200, ...params }),
        enabled: params.payroll_run_id !== undefined ? Boolean(params.payroll_run_id) : true,
    });

    return {
        payslips: query.data?.data || [],
        isLoading: query.isLoading,
        error: query.isError ? errMsg(query.error, 'Failed to load payslips.') : null,
        refetch: query.refetch,
    };
}

export function usePayslip(uuid) {
    const query = useQuery({
        queryKey: ['payslip', uuid],
        queryFn: () => payslipService.getByUuid(uuid),
        select: (res) => res?.data || null,
        enabled: Boolean(uuid),
    });
    return { payslip: query.data, isLoading: query.isLoading };
}

/* ---- Payslip copy requests (admin review) ---- */
export function usePayslipRequests(params = {}) {
    const qc = useQueryClient();
    const invalidate = () => qc.invalidateQueries({ queryKey: ['payslipRequests'] });

    const query = useQuery({
        queryKey: ['payslipRequests', params],
        queryFn: () => payslipRequestService.getAll({ limit: 200, ...params }),
        keepPreviousData: true,
    });

    const fulfillMutation = useMutation({
        mutationFn: ({ uuid, payload = {} }) => payslipRequestService.fulfill(uuid, payload),
        onSuccess: (res) => { toast.success(res?.message || 'Request fulfilled.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to fulfill request.')),
    });

    const rejectMutation = useMutation({
        mutationFn: ({ uuid, payload = {} }) => payslipRequestService.reject(uuid, payload),
        onSuccess: (res) => { toast.success(res?.message || 'Request rejected.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to reject request.')),
    });

    const removeMutation = useMutation({
        mutationFn: (uuid) => payslipRequestService.remove(uuid),
        onSuccess: (res) => { toast.success(res?.message || 'Request archived.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to archive request.')),
    });

    return {
        items: query.data?.data || [],
        pagination: query.data?.pagination || null,
        isLoading: query.isLoading,
        error: query.isError ? errMsg(query.error, 'Failed to load payslip requests.') : null,
        refetch: query.refetch,
        fulfill: fulfillMutation.mutateAsync,
        reject: rejectMutation.mutateAsync,
        remove: removeMutation.mutateAsync,
        isMutating: fulfillMutation.isPending || rejectMutation.isPending || removeMutation.isPending,
    };
}

/**
 * Lightweight count of still-open payslip copy requests — powers the sidebar badge.
 * Shares the `['payslipRequests', …]` cache family so review actions refresh it.
 */
export function usePendingPayslipRequests({ enabled = true } = {}) {
    return useQuery({
        queryKey: ['payslipRequests', { status: 'pending', badge: true }],
        queryFn: () => payslipRequestService.getAll({ status: 'pending', limit: 100 }),
        select: (res) => res?.data || [],
        enabled,
        refetchInterval: 60_000,
        refetchOnWindowFocus: true,
    });
}

/* ---- Run adjustments ---- */
export function useRunAdjustments(runUuid) {
    const qc = useQueryClient();
    const invalidate = () => qc.invalidateQueries({ queryKey: ['runAdjustments', runUuid] });

    const query = useQuery({
        queryKey: ['runAdjustments', runUuid],
        queryFn: () => payrollRunService.listAdjustments(runUuid),
        select: (res) => res?.data || [],
        enabled: Boolean(runUuid),
    });

    const createMutation = useMutation({
        mutationFn: (payload) => payrollRunService.createAdjustment(runUuid, payload),
        onSuccess: (res) => { toast.success(res?.message || 'Adjustment queued.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to queue adjustment.')),
    });

    const removeMutation = useMutation({
        mutationFn: (uuid) => payrollRunService.removeAdjustment(uuid),
        onSuccess: (res) => { toast.success(res?.message || 'Adjustment removed.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to remove adjustment.')),
    });

    return {
        adjustments: query.data || [],
        isLoading: query.isLoading,
        create: createMutation.mutateAsync,
        remove: removeMutation.mutateAsync,
        isMutating: createMutation.isPending || removeMutation.isPending,
    };
}

/**
 * Employer profile — the single registered-employer identity row used by every
 * government filing artifact. `_completeness` on the payload lists what's still
 * missing before forms can be generated.
 */
export function useEmployerProfile() {
    const qc = useQueryClient();

    const query = useQuery({
        queryKey: ['employerProfile'],
        queryFn: () => employerProfileService.get(),
        select: (res) => res?.data || null,
        staleTime: 5 * 60 * 1000,
    });

    const updateMutation = useMutation({
        mutationFn: (payload) => employerProfileService.update(payload),
        onSuccess: (res) => {
            toast.success(res?.message || 'Employer profile saved.');
            qc.invalidateQueries({ queryKey: ['employerProfile'] });
            qc.invalidateQueries({ queryKey: ['govForms'] });
        },
        onError: (err) => toast.error(errMsg(err, 'Failed to save employer profile.')),
    });

    return {
        profile: query.data || null,
        completeness: query.data?._completeness || { isComplete: false, missing: [] },
        isLoading: query.isLoading,
        error: query.isError ? errMsg(query.error, 'Failed to load employer profile.') : null,
        save: updateMutation.mutateAsync,
        isSaving: updateMutation.isPending,
    };
}
