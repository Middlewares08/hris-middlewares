import { useMutation, useQuery } from '@tanstack/react-query';
import { setupService } from '../services/setupServices';
import { can } from '../utils/permissionCheck';

const FALLBACK = { wizardEnabled: false, resetAllowed: false, completed: true, steps: [] };

/**
 * Setup Wizard checklist status — the config on/off switch plus each step's
 * live done/pending state. Skipped entirely for accounts without
 * `setup-wizard:view` (custom roles narrower than Administrator), so the
 * wizard never blocks or nags a role that couldn't act on it anyway.
 */
export function useSetupStatus(options = {}) {
    const enabled = options.enabled ?? can('setup-wizard:view');

    const query = useQuery({
        queryKey: ['setupStatus'],
        queryFn: setupService.getStatus,
        select: (res) => res?.data || FALLBACK,
        enabled,
        staleTime: 30_000,
    });

    return {
        data: enabled ? (query.data || FALLBACK) : FALLBACK,
        isLoading: enabled && query.isLoading,
    };
}

const errMsg = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

/**
 * "Start Fresh" — irreversible full database reset. Deliberately does NOT
 * touch React Query's cache or navigation itself; every cached query is stale
 * the instant this succeeds, so the caller (SetupWizard) is expected to clear
 * auth state and hard-redirect to login rather than try to patch up state.
 */
export function useResetDatabase() {
    const mutation = useMutation({
        mutationFn: setupService.resetDatabase,
    });

    return {
        resetDatabase: mutation.mutateAsync,
        isResetting: mutation.isPending,
        error: mutation.error ? errMsg(mutation.error, 'Database reset failed.') : null,
    };
}
