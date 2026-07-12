import { useState, useEffect, useCallback } from 'react';
import { departmentService } from '../services/departmentServices';
import { toast } from 'sonner';

export function useDepartments() {
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // Track structural pagination states locally
    const [currentPage, setCurrentPage] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');

    /**
     * 🔍 READ (Paginated List Sync)
     */
    const fetchDepartments = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await departmentService.getAll({
                page: currentPage,
                limit: 10,
                search: searchQuery
            });
            
            if (result.success) {
                setDepartments(result.data);
                setTotalRecords(result.pagination.totalRecords);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to sync departments.');
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchQuery]);

    // Re-run lifecycle trigger when query state elements mutate
    useEffect(() => {
        let isMounted = true;

        const executeFetch = async () => {
            if (isMounted) {
                await fetchDepartments();
            }
        };

        executeFetch();

        return () => {
            isMounted = false; // Prevents cascading updates if the component unmounts or re-renders rapidly
        };
    }, [fetchDepartments]);

    /**
     * ➕ CREATE (Add New Node)
     */
    const handleCreate = async (payload) => {
        setLoading(true);
        setError(null);
        try {
            const result = await departmentService.create(payload);
            if (result.success) {
                toast.success("Department created successfully.")
                await fetchDepartments(); // Dynamic index re-fetch
                return result;
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to create department.';
            setError(msg);
            
            throw new Error(msg, { cause: err });
        } finally {
            setLoading(false);
        }
    };

    /**
     * 🔄 UPDATE (Modify Existing Node Fields)
     */
    const handleUpdate = async (uuid, payload) => {
        setLoading(true);
        setError(null);
        try {
            const result = await departmentService.update(uuid, payload);
            if (result.success) {
                toast.success("Department updated successfully.")
                await fetchDepartments(); // Dynamic index re-fetch
                return result;
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to update department details.';
            setError(msg);

            throw new Error(msg, { cause: err });
        } finally {
            setLoading(false);
        }
    };

    /**
     * ❌ DELETE (Archive Matrix Node)
     */
    const handleDelete = async (uuid) => {
        setLoading(true);
        setError(null);
        try {
            const result = await departmentService.delete(uuid);
            if (result.success) {
                // If we're on page 2+ and delete the last remaining record on that page,
                // step down one page level so the table doesn't break into an empty layout grid.
                toast.success('Department deleted successfully.');
                if (departments.length === 1 && currentPage > 1) {
                    setCurrentPage((prev) => prev - 1);
                } else {
                    await fetchDepartments();
                }
                return result;
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to archive department.';
            setError(msg);
           throw new Error(msg, { cause: err });
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (query) => {
        setSearchQuery(query);
        setCurrentPage(1); // Reset to index zero page whenever query states mutate
    };

    const handlePageChange = (page) => {
        setCurrentPage(page);
    };

    return {
        departments,
        loading,
        error,
        currentPage,
        totalRecords,
        handleSearch,
        handlePageChange,
        handleCreate,
        handleUpdate,
        handleDelete,
        refreshList: fetchDepartments
    };
}