import apiClient from '../api/index';

const BASE = '/holidays';

/**
 * Holiday calendar. Gated server-side by `shift-and-rostering:*`.
 */
export const holidayService = {
    // params = { year, from, to, search }
    getAll: async (params = {}) => (await apiClient.get(BASE, { params })).data,
    // payload = { date, name, type, is_active }
    create: async (payload) => (await apiClient.post(BASE, payload)).data,
    update: async (uuid, payload) => (await apiClient.put(`${BASE}/${uuid}`, payload)).data,
    remove: async (uuid) => (await apiClient.delete(`${BASE}/${uuid}`)).data,
};
