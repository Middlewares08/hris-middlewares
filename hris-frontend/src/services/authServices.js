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
    }
};