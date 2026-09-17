// src/services/setupServices.js
import apiClient from '../api/index';

export const setupService = {
    /** Wizard on/off switch + each checklist step's live done/pending state. */
    getStatus: async () => {
        const { data } = await apiClient.get('/system/setup/status');
        return data;
    },

    /**
     * "Start Fresh" — wipes every record and re-seeds a blank install. Only
     * reachable at all when the status response says `resetAllowed`; the
     * server independently re-checks its own ALLOW_DB_RESET env flag.
     */
    resetDatabase: async ({ password, confirmEmail }) => {
        const { data } = await apiClient.post('/system/setup/reset', { password, confirmEmail });
        return data;
    },
};
