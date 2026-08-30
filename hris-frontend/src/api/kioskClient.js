import axios from 'axios';

/**
 * Axios instance for the unattended attendance kiosk. It authenticates with a
 * per-device token (X-Kiosk-Token), NOT the admin JWT — so no auth interceptor
 * and no refresh/redirect behaviour.
 */
const kioskClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
});

kioskClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('kioskToken');
    if (token) config.headers['X-Kiosk-Token'] = token;
    return config;
});

export default kioskClient;
