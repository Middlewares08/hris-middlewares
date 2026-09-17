// src/api/index.js
import  apiClient  from '../api/index';

export const authService = {
    login: async (payload) => {
        // payload = { email, password }
        const { data } = await apiClient.post('/auth/login', payload);
        return data; 
    },
    verifyOtp: async (payload) => {
        // payload = { token, code }
        const { data } = await apiClient.post('/auth/login/verify-otp', payload);
        return data;
    },

    getCurrentProfile: async () => {
        const response = await apiClient.get('/auth/me');
        return response.data; // Resolves to the user layout data block
    },

    /** Consumes the token from an emailed reset/first-login link. payload = { token, password } */
    resetPassword: async (payload) => {
        const { data } = await apiClient.post('/auth/reset-password', payload);
        return data;
    },
};