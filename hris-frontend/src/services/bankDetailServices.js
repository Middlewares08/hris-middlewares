import apiClient from '../api/index';

const API_BASE_URL = '/employee/list/bank-details';

export const bankDetailsService = {
    /**
     * Fetch all employees with the bank / payment fields from their active
     * compensation record (account number masked, never the ciphertext).
     */
    getAll: async (params = {}) => {
        const response = await apiClient.get(API_BASE_URL, { params });
        return response.data;
    },

    /**
     * Patch bank / payment details onto an employee's active compensation row.
     * A blank/omitted bank_account_number keeps the stored one.
     * payload = { bank_name?, bank_account_name?, bank_account_number?, payment_method? }
     */
    upsert: async (employeeId, payload) => {
        const { data } = await apiClient.post(API_BASE_URL, { employeeId, ...payload });
        return data;
    },
};
