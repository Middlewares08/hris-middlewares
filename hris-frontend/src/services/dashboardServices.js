import apiClient from '../api/index';

const BASE = '/dashboard';

// Admin dashboard analytics — gated server-side by the 'dashboard:view' permission.
export const dashboardService = {
    // params = { days }  (attendance-trend window, 7–60, default 14)
    getAnalytics: async (params = {}) => (await apiClient.get(`${BASE}/analytics`, { params })).data,
};
