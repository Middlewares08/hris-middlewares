import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import announcementService from '../services/announcementServices';

const errMsg = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

/**
 * List + CRUD + status hook for the admin announcements page.
 * The list is fetched with a generous limit and paginated client-side by CustomDataTable.
 */
export function useAnnouncements(params = {}) {
    const qc = useQueryClient();
    const invalidate = () => qc.invalidateQueries({ queryKey: ['announcements'] });

    const query = useQuery({
        queryKey: ['announcements', params],
        queryFn: () => announcementService.getAll({ limit: 200, ...params }),
        keepPreviousData: true,
    });

    const createMutation = useMutation({
        mutationFn: (payload) => announcementService.create(payload),
        onSuccess: (res) => { toast.success(res?.message || 'Announcement created.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to create announcement.')),
    });

    const updateMutation = useMutation({
        mutationFn: ({ uuid, payload }) => announcementService.update(uuid, payload),
        onSuccess: (res) => { toast.success(res?.message || 'Announcement updated.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to update announcement.')),
    });

    const statusMutation = useMutation({
        mutationFn: ({ uuid, status }) => announcementService.setStatus(uuid, status),
        onSuccess: (res) => { toast.success(res?.message || 'Status updated.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to update status.')),
    });

    const removeMutation = useMutation({
        mutationFn: (uuid) => announcementService.remove(uuid),
        onSuccess: (res) => { toast.success(res?.message || 'Announcement archived.'); invalidate(); },
        onError: (err) => toast.error(errMsg(err, 'Failed to archive announcement.')),
    });

    return {
        items: query.data?.data || [],
        pagination: query.data?.pagination || null,
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.isError ? errMsg(query.error, 'Failed to load announcements.') : null,
        refetch: query.refetch,
        create: createMutation.mutateAsync,
        update: updateMutation.mutateAsync,
        setStatus: statusMutation.mutateAsync,
        remove: removeMutation.mutateAsync,
        isMutating:
            createMutation.isPending ||
            updateMutation.isPending ||
            statusMutation.isPending ||
            removeMutation.isPending,
    };
}

export function useAnnouncement(uuid) {
    const query = useQuery({
        queryKey: ['announcement', uuid],
        queryFn: () => announcementService.getByUuid(uuid),
        select: (res) => res?.data || null,
        enabled: Boolean(uuid),
    });
    return {
        announcement: query.data,
        isLoading: query.isLoading,
        error: query.isError ? errMsg(query.error, 'Failed to load announcement.') : null,
    };
}
