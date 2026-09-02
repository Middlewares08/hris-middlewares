import apiClient from '../api/index';

const BASE = '/reports';

/**
 * HR reports — one aggregate payload per report key, gated server-side by
 * `reports:view`. params = { dateFrom, dateTo } (both YYYY-MM-DD, optional).
 *
 * keys: headcount | attendance | absence | leave | overtime | payroll |
 *       turnover | new-hires | separations | departments | performance | training
 */
export const reportService = {
    get: async (key, params = {}) => (await apiClient.get(`${BASE}/${key}`, { params })).data,
};
