// src/hooks/useRolesSummary.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { roleServices } from '../services/roleServices';

export function useRoles() {
    const queryClient = useQueryClient();

    const invalidateRoles = () => {
        queryClient.invalidateQueries({ queryKey: ['roles'] });
    };

    const readError = (error, fallback) =>
        error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback;

    // 1. Fetch Query
    const rolesQuery = useQuery({
        queryKey: ['roles'],
        queryFn: roleServices.getRolesSummary,
    });

    // 2. Create Mutation
    const createMutation = useMutation({
        mutationFn: roleServices.createRole,
        onSuccess: () => {
            invalidateRoles();
            toast.success('Role created.');
        },
        onError: (error) => toast.error(readError(error, 'Failed to create role.')),
    });

    // 3. Update Mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, roleData }) => roleServices.updateRole(id, roleData),
        onSuccess: () => {
            invalidateRoles();
            toast.success('Role updated.');
        },
        onError: (error) => toast.error(readError(error, 'Failed to update role.')),
    });

    // 4. Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: roleServices.deleteRole,
        onSuccess: () => {
            invalidateRoles();
            toast.success('Role deleted.');
        },
        onError: (error) => toast.error(readError(error, 'Failed to delete role.')),
    });

    // 5. Sync Permissions Mutation
    const syncPermissionsMutation = useMutation({
        mutationFn: ({ id, permissionIds }) => roleServices.syncPermissions(id, permissionIds),
        onSuccess: () => {
            invalidateRoles();
            toast.success('Permissions updated.');
        },
        onError: (error) => toast.error(readError(error, 'Failed to update permissions.')),
    });

    return {
        // Core Grid Data & Global Fetch State
        roles: rolesQuery.data || [],
        isLoading: rolesQuery.isLoading,
        error: readError(rolesQuery.error, null),
        refetch: rolesQuery.refetch,

        // Create API Handlers
        addRole: createMutation.mutateAsync,
        isCreating: createMutation.isPending,

        // Update API Handlers (Pass as: editRole({ id: 1, roleData: { name: '...' } }))
        editRole: updateMutation.mutateAsync,
        isUpdating: updateMutation.isPending,

        // Delete API Handlers
        removeRole: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isPending,

        // Permission Sync Handlers (Pass as: syncPermissions({ id: 1, permissionIds: [1, 2, 3] }))
        syncPermissions: syncPermissionsMutation.mutateAsync,
        isSyncing: syncPermissionsMutation.isPending,

        mutationError:
            readError(createMutation.error, null) ||
            readError(updateMutation.error, null) ||
            readError(deleteMutation.error, null) ||
            readError(syncPermissionsMutation.error, null),
    };
}
