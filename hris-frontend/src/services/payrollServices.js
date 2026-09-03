import apiClient from '../api/index';

const BASE = '/payroll';

// Generic CRUD factory — every payroll resource follows the same REST shape.
const crud = (path) => ({
    getAll: async (params = {}) => (await apiClient.get(`${BASE}/${path}`, { params })).data,
    getByUuid: async (uuid) => (await apiClient.get(`${BASE}/${path}/${uuid}`)).data,
    create: async (payload) => (await apiClient.post(`${BASE}/${path}`, payload)).data,
    update: async (uuid, payload) => (await apiClient.put(`${BASE}/${path}/${uuid}`, payload)).data,
    remove: async (uuid) => (await apiClient.delete(`${BASE}/${path}/${uuid}`)).data,
});

export const payComponentService = crud('components');
export const statutoryTableService = crud('statutory-tables');
export const compensationService = {
    ...crud('compensations'),
    getActiveForEmployee: async (employeeId, params = {}) =>
        (await apiClient.get(`${BASE}/compensations/employee/${employeeId}/active`, { params })).data,
};
export const assignmentService = crud('assignments');
export const payPeriodService = crud('periods');

export const payrollRunService = {
    ...crud('runs'),
    calculate: async (uuid, payload = {}) => (await apiClient.post(`${BASE}/runs/${uuid}/calculate`, payload)).data,
    approve: async (uuid) => (await apiClient.patch(`${BASE}/runs/${uuid}/approve`)).data,
    markPaid: async (uuid, payload = {}) => (await apiClient.patch(`${BASE}/runs/${uuid}/mark-paid`, payload)).data,
    cancel: async (uuid) => (await apiClient.patch(`${BASE}/runs/${uuid}/cancel`)).data,
    listAdjustments: async (runUuid) => (await apiClient.get(`${BASE}/runs/${runUuid}/adjustments`)).data,
    createAdjustment: async (runUuid, payload) => (await apiClient.post(`${BASE}/runs/${runUuid}/adjustments`, payload)).data,
    removeAdjustment: async (uuid) => (await apiClient.delete(`${BASE}/adjustments/${uuid}`)).data,
};

export const payslipService = {
    getAll: async (params = {}) => (await apiClient.get(`${BASE}/payslips`, { params })).data,
    getByUuid: async (uuid) => (await apiClient.get(`${BASE}/payslips/${uuid}`)).data,
    setStatus: async (uuid, status) => (await apiClient.patch(`${BASE}/payslips/${uuid}/status`, { status })).data,
    // Returns the raw axios response so the caller can read the blob + Content-Disposition.
    downloadPdf: async (uuid) => apiClient.get(`${BASE}/payslips/${uuid}/pdf`, { responseType: 'blob' }),
};

export const employerProfileService = {
    get: async () => (await apiClient.get(`${BASE}/employer-profile`)).data,
    update: async (payload) => (await apiClient.put(`${BASE}/employer-profile`, payload)).data,
};

export const payslipRequestService = {
    getAll: async (params = {}) => (await apiClient.get(`${BASE}/payslip-requests`, { params })).data,
    fulfill: async (uuid, payload = {}) => (await apiClient.patch(`${BASE}/payslip-requests/${uuid}/fulfill`, payload)).data,
    reject: async (uuid, payload = {}) => (await apiClient.patch(`${BASE}/payslip-requests/${uuid}/reject`, payload)).data,
    remove: async (uuid) => (await apiClient.delete(`${BASE}/payslip-requests/${uuid}`)).data,
};
