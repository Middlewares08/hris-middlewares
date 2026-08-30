import apiClient from '../api/index';

const API_BASE_URL = '/face-enrollment';

export const faceEnrollmentService = {
    // GET: current enrollment for an employee (data is null when not enrolled)
    getByEmployeeId: async (employeeId) => {
        const response = await apiClient.get(`${API_BASE_URL}/${employeeId}`);
        return response.data;
    },

    // POST: enroll or re-capture — expects a FormData (employee_id, consent, image)
    enroll: async (formData) => {
        const response = await apiClient.post(API_BASE_URL, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },

    // DELETE: remove an employee's enrollment
    remove: async (employeeId) => {
        const response = await apiClient.delete(`${API_BASE_URL}/${employeeId}`);
        return response.data;
    },
};
