import apiClient from '../api/index';

const BASE = '/announcements';

// Admin announcement CRUD — gated server-side by the 'announcements' module permissions.
const announcementService = {
    getAll: async (params = {}) => (await apiClient.get(BASE, { params })).data,
    getByUuid: async (uuid) => (await apiClient.get(`${BASE}/${uuid}`)).data,
    create: async (payload) => (await apiClient.post(BASE, payload)).data,
    update: async (uuid, payload) => (await apiClient.put(`${BASE}/${uuid}`, payload)).data,
    setStatus: async (uuid, status) => (await apiClient.patch(`${BASE}/${uuid}/status`, { status })).data,
    remove: async (uuid) => (await apiClient.delete(`${BASE}/${uuid}`)).data,
};

export default announcementService;
