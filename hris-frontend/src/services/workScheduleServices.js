import apiClient from '../api/index';

const BASE = '/work-schedules';

/**
 * Work schedules (weekly shift patterns) + employee assignment.
 * Gated server-side by `shift-and-rostering:*`.
 */
export const workScheduleService = {
    // params = { page, limit, search }
    getAll: async (params = {}) => (await apiClient.get(BASE, { params })).data,
    listAll: async () => (await apiClient.get(`${BASE}/list/all`)).data,
    getByUuid: async (uuid) => (await apiClient.get(`${BASE}/${uuid}`)).data,
    // payload = { name, description, grace_minutes, half_day_hours, is_default, is_active, days: [{ weekday, is_workday, start_time, end_time, break_minutes }] }
    create: async (payload) => (await apiClient.post(BASE, payload)).data,
    update: async (uuid, payload) => (await apiClient.put(`${BASE}/${uuid}`, payload)).data,
    remove: async (uuid) => (await apiClient.delete(`${BASE}/${uuid}`)).data,

    // employee assignment
    // payload = { employee_id, schedule_uuid | schedule_id, effective_date }
    assign: async (payload) => (await apiClient.post(`${BASE}/assign`, payload)).data,
    employeeAssignments: async (employeeId) => (await apiClient.get(`${BASE}/employee/${employeeId}`)).data,
};
