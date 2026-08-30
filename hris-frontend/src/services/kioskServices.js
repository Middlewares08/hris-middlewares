import apiClient from '../api/index';
import kioskClient from '../api/kioskClient';

/** Device-token calls — used by the /kiosk screen itself. */
export const kioskDeviceService = {
    getConfig: async () => {
        const { data } = await kioskClient.get('/kiosk/config');
        return data;
    },
    startLiveness: async () => {
        const { data } = await kioskClient.post('/kiosk/liveness-session');
        return data;
    },
    punch: async (livenessSessionId) => {
        const { data } = await kioskClient.post('/kiosk/punch', {
            liveness_session_id: livenessSessionId,
        });
        return data;
    },
};

/** Admin calls — kiosk device management (normal JWT + permissions). */
export const kioskAdminService = {
    listDevices: async () => {
        const { data } = await apiClient.get('/kiosk/devices');
        return data;
    },
    createDevice: async (payload) => {
        const { data } = await apiClient.post('/kiosk/devices', payload);
        return data;
    },
    revokeDevice: async (uuid) => {
        const { data } = await apiClient.delete(`/kiosk/devices/${uuid}`);
        return data;
    },
    reindex: async () => {
        const { data } = await apiClient.post('/kiosk/reindex');
        return data;
    },
};
