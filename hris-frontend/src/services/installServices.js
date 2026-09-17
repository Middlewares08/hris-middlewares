// src/services/installServices.js
import apiClient from '../api/index';

export const installService = {
    /** Unauthenticated — drives the app-wide install gate on every page load. */
    getStatus: async () => {
        const { data } = await apiClient.get('/public/install/status');
        return data;
    },

    /** Step 1 — check the product key before asking for admin details. */
    validateKey: async (productKey) => {
        const { data } = await apiClient.post('/public/install/validate-key', { productKey });
        return data;
    },

    /** Step 2 — creates the first admin; a first-login link is emailed to them. */
    completeInstall: async ({ productKey, email, firstName, lastName }) => {
        const { data } = await apiClient.post('/public/install/complete', { productKey, email, firstName, lastName });
        return data;
    },
};
