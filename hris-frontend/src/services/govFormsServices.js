import apiClient from '../api/index';

const BASE = '/payroll/gov-forms';

/**
 * PH government filing artifacts (BIR 2316 / Alphalist, SSS R3, PhilHealth RF1,
 * Pag-IBIG MCRF). Gated server-side by `government-forms:view` / `:generate`.
 */
export const govFormsService = {
    catalogue: async () => (await apiClient.get(BASE)).data,

    // params = { form, year, month?, statuses? }
    preview: async (params = {}) => (await apiClient.get(`${BASE}/preview`, { params })).data,

    // params = { form, year, month?, format?, employee_id?, statuses? }
    // Returns the raw axios response so the caller can read the blob + Content-Disposition.
    download: async (params = {}) => apiClient.get(`${BASE}/download`, { params, responseType: 'blob' }),
};
