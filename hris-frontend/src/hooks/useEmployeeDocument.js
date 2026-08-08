import { useState, useEffect, useCallback } from 'react';
import { employeeDocumentService } from '../services/employeeDocumentServices';
import { toast } from 'sonner';

export function useEmployeeDocuments(employeeId = null) {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // 🎯 Standard pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [recordsPerPage, setRecordsPerPage] = useState(10);

    /**
     * 🔍 READ (Paginated Fetch / Specific Employee Fetch)
     */
    const fetchDocuments = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let result;
            if (employeeId) {
                result = await employeeDocumentService.getByEmployeeId(employeeId);
            } else {
                result = await employeeDocumentService.getAll({
                    page: currentPage,
                    limit: recordsPerPage,
                    search: searchQuery
                });
            }

            if (result.success) {
                setDocuments(result.data);
                // Handle pagination properties if returned from backend
                if (result.pagination) {
                    setTotalRecords(result.pagination.totalRecords || 0);
                } else if (result.totalRecords !== undefined) {
                    setTotalRecords(result.totalRecords);
                } else {
                    setTotalRecords(result.data?.length || 0);
                }
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Failed to sync employee documents.');
        } finally {
            setLoading(false);
        }
    }, [employeeId, currentPage, searchQuery, recordsPerPage]);

    // Lifecycle trigger with mount safety guard
    useEffect(() => {
        let isMounted = true;

        const executeFetch = async () => {
            if (isMounted) {
                await fetchDocuments();
            }
        };

        executeFetch();

        return () => {
            isMounted = false;
        };
    }, [fetchDocuments]);

    /**
     * 🔄 UPSERT (Insert or Update Document)
     */
    const handleUpsert = async (payload) => {
        setLoading(true);
        setError(null);
        try {
            const result = await employeeDocumentService.upsert(payload);
            if (result.success || result) {
                toast.success(result.message || "Document record saved successfully.");
                await fetchDocuments(); // Refresh list to reflect updates
                return result;
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to save document.';
            toast.error(msg);
            setError(msg);
            throw new Error(msg, { cause: err });
        } finally {
            setLoading(false);
        }
    };

    /**
     * ❌ DELETE (Soft-Delete / Archive Document)
     */
    const handleDelete = async (id) => {
        setLoading(true);
        setError(null);
        try {
            const result = await employeeDocumentService.delete(id);
            if (result.success || result) {
                toast.success(result.message || "Document removed successfully.");
                await fetchDocuments();
                return result;
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to delete document.';
            toast.error(msg);
            setError(msg);
            throw new Error(msg, { cause: err });
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (query) => {
        setSearchQuery(query);
        setCurrentPage(1); // Reset to page 1 whenever query changes
    };

    const handlePageChange = (page) => {
        setCurrentPage(page);
    };

    return {
        documents,
        loading,
        error,
        currentPage,
        totalRecords,
        recordsPerPage,
        handleSearch,
        handlePageChange,
        handleUpsert,
        handleDelete,
        refreshList: fetchDocuments
    };
}