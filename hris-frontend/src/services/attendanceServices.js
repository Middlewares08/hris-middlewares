import apiClient from '../api/index';

const BASE = '/attendance';

export const attendanceService = {
    // params = { page, limit, search, employee_id, status, date_from, date_to }
    getAll: async (params = {}) => (await apiClient.get(BASE, { params })).data,
    getByUuid: async (uuid) => (await apiClient.get(`${BASE}/${uuid}`)).data,
    getByEmployee: async (employeeId, params = {}) =>
        (await apiClient.get(`${BASE}/employee/${employeeId}`, { params })).data,
    // payload = { employee_id, log_date, time_in, time_out, status, source, remarks }
    create: async (payload) => (await apiClient.post(BASE, payload)).data,
    // payload = { time_in, time_out, status, source, remarks }
    update: async (uuid, payload) => (await apiClient.put(`${BASE}/${uuid}`, payload)).data,
    remove: async (uuid) => (await apiClient.delete(`${BASE}/${uuid}`)).data,
};
