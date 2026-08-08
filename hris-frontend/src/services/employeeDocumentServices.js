import apiClient from '../api/index'; 

const API_BASE_URL = '/employee/list/documents';

export const employeeDocumentService = {
    // GET: Fetch all documents (paginated)
    getAll: async (params = {}) => {
        const response = await apiClient.get(API_BASE_URL, { params });
        return response.data;
    },

    // GET: Fetch documents by Employee ID
    getByEmployeeId: async (employeeId) => {
        const response = await apiClient.get(`${API_BASE_URL}/employee/${employeeId}`);
        return response.data;
    },

    // GET: Fetch single document by ID
    getById: async (id) => {
        const response = await apiClient.get(`${API_BASE_URL}/${id}`);
        return response.data;
    },

    // POST: Insert new document(s)
    create: async (payload) => {
        const response = await apiClient.post(API_BASE_URL, payload);
        return response.data;
    },

    // PUT: Patch document by ID
    update: async (id, payload) => {
        const response = await apiClient.put(`${API_BASE_URL}/${id}`, payload);
        return response.data;
    },

    // POST: Intelligent Create or Update
    upsert: async (payload) => {
        const response = await apiClient.post(`${API_BASE_URL}/upsert`, payload);
        return response.data;
    },

    // DELETE: Archive document
    delete: async (id) => {
        const response = await apiClient.delete(`${API_BASE_URL}/${id}`);
        return response.data;
    }
};