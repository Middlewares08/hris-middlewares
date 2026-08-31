import { useState, useEffect, useCallback } from 'react';
import { bankDetailsService } from '../services/bankDetailServices';
import { toast } from 'sonner';

// Mirrors useEmployeeBenefits (useGovernmentDetail.js) — the admin bank-details
// screen is the counterpart of the employee self-service "Bank Details" section.
export function useEmployeeBankDetails() {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [recordsPerPage, setRecordsPerPage] = useState(10);

    const fetchBankDetails = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await bankDetailsService.getAll({
                page: currentPage,
                limit: recordsPerPage,
                search: searchQuery,
            });

            if (result.success) {
                setEmployees(result.data);
                setTotalRecords(result.totalRecords);
                setRecordsPerPage(result.recordsPerPage || 10);
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Failed to load bank details.');
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchQuery, recordsPerPage]);

    useEffect(() => {
        let isMounted = true;
        const run = async () => { if (isMounted) await fetchBankDetails(); };
        run();
        return () => { isMounted = false; };
    }, [fetchBankDetails]);

    const handleUpsert = async (employeeId, payload) => {
        setLoading(true);
        setError(null);
        try {
            const result = await bankDetailsService.upsert(employeeId, payload);
            toast.success(result?.message || 'Bank details updated.');
            await fetchBankDetails();
            return result;
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to update bank details.';
            toast.error(msg);
            setError(msg);
            throw new Error(msg, { cause: err });
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (query) => {
        setSearchQuery(query);
        setCurrentPage(1);
    };

    const handlePageChange = (page) => setCurrentPage(page);

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
        refreshList: fetchBankDetails,
    };
}
