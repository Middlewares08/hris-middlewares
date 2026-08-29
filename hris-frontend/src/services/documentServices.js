import apiClient from '../api/index';

const BASE = '/documents';

export const documentService = {
    // Admin — one employee's library + their request list, in a single call.
    listForEmployee: async (employeeId) => (await apiClient.get(`${BASE}/employee/${employeeId}`)).data,
    // `formData` is built by buildDocumentForm() — the file is uploaded to S3 by
    // the backend, which stores its object key and returns a presigned `file_url`.
    addDocument: async (formData) => (await apiClient.post(BASE, formData)).data,
    deleteDocument: async (id) => (await apiClient.delete(`${BASE}/${id}`)).data,

    // Admin — document requests
    listRequests: async (params = {}) => (await apiClient.get(`${BASE}/requests`, { params })).data,
    createRequest: async (payload) => (await apiClient.post(`${BASE}/requests`, payload)).data,
    updateRequest: async (id, payload) => (await apiClient.put(`${BASE}/requests/${id}`, payload)).data,
    cancelRequest: async (id) => (await apiClient.patch(`${BASE}/requests/${id}/cancel`)).data,
    deleteRequest: async (id) => (await apiClient.delete(`${BASE}/requests/${id}`)).data,
};

/**
 * Build the multipart payload the documents API expects.
 * @param {{ employeeId: string|number, label?: string, file?: File }} opts
 */
export const buildDocumentForm = ({ employeeId, label, file } = {}) => {
    const fd = new FormData();
    if (employeeId != null) fd.append('employee_id', employeeId);
    if (label != null) fd.append('label', label);
    if (file) fd.append('file', file);
    return fd;
};

export const MAX_DOC_BYTES = 4 * 1024 * 1024;
