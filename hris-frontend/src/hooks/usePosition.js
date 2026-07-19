import { useState, useEffect, useCallback } from 'react';
import { positionService } from '../services/positionService';
import { toast } from 'sonner';

export function usePositions() {
    const [positions, setPositions] = useState([]);
    const [positionList, setPositionsList] = useState([]);
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
    const fetchPositions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await positionService.getAll({
                page: currentPage,
                limit: 10,
                search: searchQuery
            });
            
            if (result.success) {
                setPositions(result.data);
                setDepartments(result?.dept)
                setTotalRecords(result.pagination.totalRecords);
            }
        } catch (err) {
            console.log(err)
            setError(err.response?.data?.message || 'Failed to sync positions.');
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchQuery]);

    const fetchAllPositions = useCallback(async () => {
        setError(null);
        try {
            const result = await positionService.getAllWithNoPagination({
                search: searchQuery
            });
            
            if (result.success) {
                setPositionsList(result.data);
            }
        } catch (err) {
            console.log(err)
            setError(err.response?.data?.message || 'Failed to sync positions.');
        } finally {
            setLoading(false);
        }
    }, [searchQuery]);

    // Re-run lifecycle trigger when query state elements mutate
    useEffect(() => {
        let isMounted = true;

        const executeFetch = async () => {
            if (isMounted) {
                await fetchPositions();
                await fetchAllPositions();
            }
        };

        executeFetch();

        return () => {
            isMounted = false; // Prevents cascading updates if the component unmounts or re-renders rapidly
        };
    }, [fetchPositions]);

    /**
     * ➕ CREATE (Add New Node)
     */
    const handleCreate = async (payload) => {
        setLoading(true);
        setError(null);
        try {
            const result = await positionService.create(payload);
            if (result.success) {
                toast.success("position created successfully.")
                await fetchPositions(); // Dynamic index re-fetch
                return result;
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to create position.';
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
            const result = await positionService.update(uuid, payload);
            if (result.success) {
                toast.success("position updated successfully.")
                await fetchPositions(); // Dynamic index re-fetch
                return result;
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to update position details.';
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
            const result = await positionService.delete(uuid);
            if (result.success) {
                // If we're on page 2+ and delete the last remaining record on that page,
                // step down one page level so the table doesn't break into an empty layout grid.
                toast.success('position deleted successfully.');
                if (positions.length === 1 && currentPage > 1) {
                    setCurrentPage((prev) => prev - 1);
                } else {
                    await fetchPositions();
                }
                return result;
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to archive position.';
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
        positions,
        positionList,
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
        refreshList: fetchPositions
    };
}