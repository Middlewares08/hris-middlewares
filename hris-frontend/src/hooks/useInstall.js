import { useMutation, useQuery } from '@tanstack/react-query';
import { installService } from '../services/installServices';

const errMsg = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

/**
 * Unauthenticated install status — drives the app-wide gate in App.jsx that
 * routes a fresh deployment's first visitor to /install before anything else.
 */
export function useInstallStatus() {
    const query = useQuery({
        queryKey: ['installStatus'],
        queryFn: installService.getStatus,
        select: (res) => res?.data?.installed ?? true,
        // Flips false -> true exactly once in the system's lifetime; no need to
        // keep re-checking once we know which side of that we're on.
        staleTime: Infinity,
        retry: 1,
    });

    return {
        // Fail safe: if the check itself errors, assume installed rather than
        // risk trapping a real deployment on the public install screen.
        installed: query.isError ? true : query.data,
        isLoading: query.isLoading,
    };
}

export function useValidateProductKey() {
    const mutation = useMutation({ mutationFn: installService.validateKey });
    return {
        validateKey: mutation.mutateAsync,
        isValidating: mutation.isPending,
        error: mutation.error ? errMsg(mutation.error, 'Could not validate the product key.') : null,
    };
}

export function useCompleteInstall() {
    const mutation = useMutation({ mutationFn: installService.completeInstall });
    return {
        completeInstall: mutation.mutateAsync,
        isInstalling: mutation.isPending,
        error: mutation.error ? errMsg(mutation.error, 'Installation failed.') : null,
    };
}
