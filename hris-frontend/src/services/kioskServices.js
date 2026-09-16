import apiClient from '../api/index';
import kioskClient from '../api/kioskClient';

/**
 * Build a kiosk punch request:
 *   - `image` (Blob)      -> multipart/form-data face photo (liveness-off mode)
 *   - `livenessSessionId` -> JSON body with a completed liveness session
 */
const punchRequest = ({ image, livenessSessionId } = {}) => {
    if (image) {
        const form = new FormData();
        form.append('image', image, 'face.jpg');
        return kioskClient.post('/kiosk/punch', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    return kioskClient.post('/kiosk/punch', { liveness_session_id: livenessSessionId });
};

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
    // args: { livenessSessionId?: string, image?: Blob }
    punch: async (args = {}) => {
        const { data } = await punchRequest(args);
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
