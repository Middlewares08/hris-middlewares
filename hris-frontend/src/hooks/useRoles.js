// src/hooks/useRolesSummary.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roleServices } from '../services/roleServices';

export function useRoles() {
    const queryClient = useQueryClient();

    // 1. Fetch Query
    const rolesQuery = useQuery({
        queryKey: ['roles'],
        queryFn: roleServices.getRolesSummary,
    });

    // 2. Create Mutation
    const createMutation = useMutation({
        mutationFn: roleServices.createRole,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] });
        },
    });

    // 3. Update Mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, roleData }) => roleServices.updateRole(id, roleData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] });
        },
    });

    // 4. Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: roleServices.deleteRole,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] });
        },
    });

    return {
        // Core Grid Data & Global Fetch State
        roles: rolesQuery.data || [],
        isLoading: rolesQuery.isLoading,
        error: rolesQuery.error?.response?.data?.message || rolesQuery.error?.message || null,
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
        mutationError: createMutation.error?.response?.data?.message || 
                       updateMutation.error?.response?.data?.message || 
                       deleteMutation.error?.response?.data?.message || null
    };
}