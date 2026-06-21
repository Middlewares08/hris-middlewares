// src/services/systemServices.js
import  apiClient  from '../api/index'; // Import your default-exported Axios instance

export const systemService = {
    /**
     * Triggers the database schema population and generates the root admin profile
     */
    initializeSystem: async () => {
        const { data } = await apiClient.post('/system/init');
        return data;
    }
};