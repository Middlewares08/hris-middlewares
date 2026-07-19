import { useState, useEffect, useCallback } from 'react';
import { governmentDetailsService } from '../services/governmentDetailServices';
import { toast } from 'sonner';

export function useEmployeeBenefits() {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // 🎯 Standard pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [recordsPerPage, setRecordsPerPage] = useState(10);

    /**
     * 🔍 READ (Paginated Fetch)
     */
    const fetchBenefits = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await governmentDetailsService.getAll({
                page: currentPage,
                limit: recordsPerPage,
                search: searchQuery
            });
            
            if (result.success) {
                setEmployees(result.data);
                setTotalRecords(result.totalRecords);
                setRecordsPerPage(result.recordsPerPage || 10);
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Failed to sync employee benefits.');
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchQuery, recordsPerPage]);

    // Lifecycle trigger
    useEffect(() => {
        let isMounted = true;

        const executeFetch = async () => {
            if (isMounted) {
                await fetchBenefits();
            }
        };

        executeFetch();

        return () => {
            isMounted = false;
        };
    }, [fetchBenefits]);

    /**
     * 🔄 UPSERT (Insert or Update Benefits)
     */
    const handleUpsert = async (employeeId, payload) => {
        setLoading(true);
        setError(null);
        try {
            const result = await governmentDetailsService.upsert(employeeId, payload);
            if (result.success || result) {
                toast.success("Government details updated successfully.");
                await fetchBenefits(); // Refresh the list to reflect new data
                return result;
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to update government details.';
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
        employees,
        loading,
        error,
        currentPage,
        totalRecords,
        recordsPerPage,
        handleSearch,
        handlePageChange,
        handleUpsert,
        refreshList: fetchBenefits
    };
}