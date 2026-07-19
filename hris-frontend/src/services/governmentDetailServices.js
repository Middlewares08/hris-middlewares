import apiClient from '../api/index'; 

const API_BASE_URL = '/employee/list/benefits'; 

export const governmentDetailsService = {

    /**
     * Fetch all employees along with their government benefits
     */
    getAll: async (params = {}) => {
         const response = await apiClient.get(API_BASE_URL, { params });
        return response.data;
    },

    /**
     * Upsert (Insert or Update) government details
     * POST /employee/benefits
     */
    upsert: async (employeeId, payload) => {
        // Sends the employeeId alongside your payload so the controller knows whose benefits to upsert
        const { data } = await apiClient.post(`${API_BASE_URL}`, {
            employeeId,
            ...payload
        });
        return data.data;
    },

    /**
     * Reset/Delete an employee's government details
     * DELETE /employee/benefits/:uuid
     */
    delete: async (employeeId) => {
        // Maps directly to the /benefits/:uuid backend route mapping
        const { data } = await apiClient.delete(`${API_BASE_URL}/${employeeId}`);
        return data.data;
    }
};