import apiClient from '../api/index'; 

const API_BASE_URL = '/lookups/positions';

export const positionService = {
    /**
     * Fetch paginated list based on backend matrix requirements
     */
    getAll: async (params = {}) => {
        const response = await apiClient.get(API_BASE_URL, { params });
        return response.data;
    },

    /**
     * Fetch single asset profile via structural UUID
     */
    getByUuid: async (uuid) => {
        const response = await apiClient.get(`${API_BASE_URL}/${uuid}`);
        return response.data;
    },

    /**
     * Post new node to schema
     */
    create: async (payload) => {
        const response = await apiClient.post(API_BASE_URL, payload);
        return response.data;
    },

    /**
     * Patch parameters via target UUID
     */
    update: async (uuid, payload) => {
        const response = await apiClient.put(`${API_BASE_URL}/${uuid}`, payload);
        return response.data;
    },

    /**
     * Soft delete node from view index
     */
    delete: async (uuid) => {
        const response = await apiClient.delete(`${API_BASE_URL}/${uuid}`);
        return response.data;
    },

    /**
     * Fetch paginated list based on backend matrix requirements
     */
    getAllWithNoPagination: async (params = {}) => {
        const response = await apiClient.get(`${API_BASE_URL}/list/data`, { params });
        return response.data;
    },

};