import apiClient from '../api/index';

const BASE = '/overtime-requests';

export const overtimeService = {
    // params = { page, limit, search, employee_id, status, date_from, date_to }
    getAll: async (params = {}) => (await apiClient.get(BASE, { params })).data,
    getByUuid: async (uuid) => (await apiClient.get(`${BASE}/${uuid}`)).data,
    getByEmployee: async (employeeId, params = {}) =>
        (await apiClient.get(`${BASE}/employee/${employeeId}`, { params })).data,
    // admin-on-behalf create: payload = { employee_id, work_date, hours, reason }
    create: async (payload) => (await apiClient.post(BASE, payload)).data,
    update: async (uuid, payload) => (await apiClient.put(`${BASE}/${uuid}`, payload)).data,
    // decision = 'approved' | 'rejected'
    review: async (uuid, decision, review_remarks) =>
        (await apiClient.patch(`${BASE}/${uuid}/review`, { decision, review_remarks })).data,
    remove: async (uuid) => (await apiClient.delete(`${BASE}/${uuid}`)).data,
};
