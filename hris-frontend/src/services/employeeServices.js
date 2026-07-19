import apiClient from '../api/index'; 

// Replace with your actual base API endpoint
const API_BASE_URL = '/employee'; 

export const employeeService = {
    /**
     * Fetch paginated list of employees
     */
    getEmployees: async ({ page = 1, limit = 10, search = '' }) => {
        const response = await apiClient.get(API_BASE_URL, {
            params: { page, limit, search }
        });
        return response.data; // Returns { success, data, totalRecords, currentPage, recordsPerPage }
    },

    /**
     * Fetch a single employee record
     */
    getEmployeeByUuid: async (uuid) => {
        const response = await apiClient.get(`${API_BASE_URL}/${uuid}`);
        return response.data;
    },

    /**
     * Create a new employee record
     */
    createEmployee: async (payload) => {
        const response = await apiClient.post(API_BASE_URL, payload);
        return response.data;
    },

    /**
     * Update an existing employee profile
     */
    updateEmployee: async (uuid, payload) => {
        const response = await apiClient.patch(`${API_BASE_URL}/${uuid}`, payload);
        return response.data;
    },

    /**
     * Soft-delete an employee profile
     */
    deleteEmployee: async (uuid) => {
        const response = await apiClient.delete(`${API_BASE_URL}/${uuid}`);
        return response.data;
    }
};