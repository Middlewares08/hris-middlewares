import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { documentService } from '../services/documentServices';

const errMsg = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

/**
 * One employee's document library + their document requests, with admin mutations.
 */
export function useDocuments(employeeId) {
    const qc = useQueryClient();
    const key = ['employeeDocuments', employeeId];
    const invalidate = () => qc.invalidateQueries({ queryKey: ['employeeDocuments'] });

    const query = useQuery({
        queryKey: key,
        queryFn: () => documentService.listForEmployee(employeeId),
        select: (res) => res?.data || { documents: [], requests: [] },
        enabled: Boolean(employeeId),
    });

    const opts = (okFallback, errFallback) => ({
        onSuccess: (res) => { toast.success(res?.message || okFallback); invalidate(); },
        onError: (err) => toast.error(errMsg(err, errFallback)),
    });

    const addDocument = useMutation({ mutationFn: (payload) => documentService.addDocument(payload), ...opts('Document added.', 'Failed to add document.') });
    const deleteDocument = useMutation({ mutationFn: (id) => documentService.deleteDocument(id), ...opts('Document archived.', 'Failed to archive document.') });
    const createRequest = useMutation({ mutationFn: (payload) => documentService.createRequest(payload), ...opts('Document requested.', 'Failed to create request.') });
    const updateRequest = useMutation({ mutationFn: ({ id, payload }) => documentService.updateRequest(id, payload), ...opts('Request updated.', 'Failed to update request.') });
    const cancelRequest = useMutation({ mutationFn: (id) => documentService.cancelRequest(id), ...opts('Request cancelled.', 'Failed to cancel request.') });
    const deleteRequest = useMutation({ mutationFn: (id) => documentService.deleteRequest(id), ...opts('Request removed.', 'Failed to remove request.') });

    return {
        documents: query.data?.documents || [],
        requests: query.data?.requests || [],
        isLoading: query.isLoading,
        error: query.isError ? errMsg(query.error, 'Failed to load documents.') : null,
        refetch: query.refetch,
        addDocument: addDocument.mutateAsync,
        deleteDocument: deleteDocument.mutateAsync,
        createRequest: createRequest.mutateAsync,
        updateRequest: updateRequest.mutateAsync,
        cancelRequest: cancelRequest.mutateAsync,
        deleteRequest: deleteRequest.mutateAsync,
        isMutating:
            addDocument.isPending || deleteDocument.isPending || createRequest.isPending ||
            updateRequest.isPending || cancelRequest.isPending || deleteRequest.isPending,
    };
}
