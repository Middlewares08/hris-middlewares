// src/api/index.js
import axios from "axios";

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL, 
    withCredentials: false, 
    headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
    },
});

// Keep your interceptor exactly as it is—it's doing the heavy lifting!
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("accessToken");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // 1. Define routes that SHOULD NOT trigger a refresh/redirect on 401
        const skipRefreshRoutes = ['/auth/login', '/auth/login/verify-otp'];
        const isSkipRoute = skipRefreshRoutes.some(route => originalRequest.url.includes(route));

        // 2. Only attempt refresh if it's a 401 AND NOT one of our skip routes
        if (error.response?.status === 401 && !originalRequest._retry && !isSkipRoute) {
            originalRequest._retry = true;

            try {
                const res = await axios.get(import.meta.env.VITE_API_BASE_URL+ '/auth/refresh', {
                    withCredentials: true 
                });

                if (res.status === 200) {
                    const { accessToken } = res.data;
                    localStorage.setItem("accessToken", accessToken);
                    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                    
                    return apiClient(originalRequest);
                }
            } catch (err) {
                console.log('apiClient ERROR: ', err);
                localStorage.removeItem("accessToken");
                // Only redirect if we aren't already on the login page
                if (window.location.pathname !== '/') {
                    window.location.href = "/auth/login";
                }
            }
        }

        // For wrong OTPs (Skip routes), just reject the error so the component can handle it
        return Promise.reject(error);
    }
);

export default apiClient;