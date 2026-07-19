import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeService } from '../services/employeeServices';
import { toast } from 'sonner'; // Replace with your toast notification engine

export const useEmployees = (filters = { page: 1, limit: 10, search: '' }) => {
    const queryClient = useQueryClient();

    // Query: Get Employees
    const {
        data: employeeData,
        isLoading,
        isError,
        refetch
    } = useQuery({
        queryKey: ['employees', filters],
        queryFn: () => employeeService.getEmployees(filters),
        keepPreviousData: true, // Prevents loading flickering during pagination changes
        staleTime: 5000,
    });

    // Mutation: Create Employee
    const createMutation = useMutation({
        mutationFn: employeeService.createEmployee,
        onSuccess: (res) => {
            queryClient.invalidateQueries(['employees']);
            toast.success(res.message || 'Employee created successfully!');
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to create employee.');
        }
    });

    // Mutation: Update Employee
    const updateMutation = useMutation({
        mutationFn: ({ uuid, payload }) => employeeService.updateEmployee(uuid, payload),
        onSuccess: (res) => {
            queryClient.invalidateQueries(['employees']);
            toast.success(res.message || 'Employee updated successfully!');
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to update employee.');
        }
    });

    // Mutation: Delete Employee
    const deleteMutation = useMutation({
        mutationFn: employeeService.deleteEmployee,
        onSuccess: (res) => {
            queryClient.invalidateQueries(['employees']);
            toast.success(res.message || 'Employee record deleted.');
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to delete employee.');
        }
    });

    return {
        employees: employeeData?.data || [],
        totalRecords: employeeData?.totalRecords || 0,
        isLoading,
        isError,
        refetch,
        createEmployee: createMutation.mutateAsync,
        isCreating: createMutation.isLoading,
        updateEmployee: updateMutation.mutateAsync,
        isUpdating: updateMutation.isLoading,
        deleteEmployee: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isLoading,
    };
};