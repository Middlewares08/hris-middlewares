// src/services/roleService.js
import apiClient from '../api/index'; 

export const roleServices = {
    /**
     * Fetches all roles alongside user and permission counts
     * @returns {Promise<Array>}
     */
    getRolesSummary: async () => {
        const { data } = await apiClient.get('/roles');
        return data.data;
    },

    /**
     * Creates a brand new system role profile
     * @param {Object} roleData - { name, slug, description }
     * @returns {Promise<Object>}
     */
    createRole: async (roleData) => {
        const { data } = await apiClient.post('/roles', roleData);
        return data.data;
    },

    /**
     * Modifies properties of an existing system role profile
     * @param {number|string} id - The unique ID of the target role
     * @param {Object} roleData - { name, slug, description }
     * @returns {Promise<Object>}
     */
    updateRole: async (id, roleData) => {
        const { data } = await apiClient.put(`/roles/${id}`, roleData);
        return data.data;
    },

    /**
     * Drops an unused role out of system records
     * @param {number|string} id - The unique ID of the target role
     * @returns {Promise<boolean>}
     */
    deleteRole: async (id) => {
        const { data } = await apiClient.delete(`/roles/${id}`);
        return data.data;
    }
};