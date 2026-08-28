// src/services/systemServices.js
import  apiClient  from '../api/index'; // Import your default-exported Axios instance

export const systemService = {
    /**
     * Triggers the database schema population and generates the root admin profile
     */
    initializeSystem: async () => {
        const { data } = await apiClient.post('/system/init');
        return data;
    },

    /** All application settings / feature flags (admin). Returns { values, rows }. */
    getSettings: async () => {
        const { data } = await apiClient.get('/system/settings');
        return data;
    },

    /** Set one known setting key. */
    updateSetting: async (key, value) => {
        const { data } = await apiClient.put(`/system/settings/${key}`, { value });
        return data;
    },
};
