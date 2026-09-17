// src/services/systemServices.js
import  apiClient  from '../api/index'; // Import your default-exported Axios instance

export const systemService = {
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
