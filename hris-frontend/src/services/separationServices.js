import apiClient from '../api/index';

const BASE = '/employee/separations';

/**
 * Employee separations / offboarding. Gated server-side by `employee-management:*`.
 */
export const separationService = {
    // params = { dateFrom, dateTo, employee_id }
    getAll: async (params = {}) => (await apiClient.get(BASE, { params })).data,
    // payload = { employee_id, separation_date, separation_type, is_voluntary, reason, ... }
    create: async (payload) => (await apiClient.post(BASE, payload)).data,
    update: async (uuid, payload) => (await apiClient.patch(`${BASE}/${uuid}`, payload)).data,
    remove: async (uuid) => (await apiClient.delete(`${BASE}/${uuid}`)).data,
};
