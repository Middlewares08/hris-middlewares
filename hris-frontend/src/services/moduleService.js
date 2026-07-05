import apiClient from '../api/index'; 


export const moduleServices = {
    /**
     * Fetches all roles alongside user and permission counts
     * @returns {Promise<Array>}
     */
    getModuleTree: async () => {
        const { data } = await apiClient.get('/modules');
        return data.module;
    },

}