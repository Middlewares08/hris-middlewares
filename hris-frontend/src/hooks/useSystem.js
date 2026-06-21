// src/hooks/useSystem.js
import { useMutation } from '@tanstack/react-query';
import { systemService } from '../services/systemServices';

export function useSystemInit() {
    const mutation = useMutation({
        mutationFn: systemService.initializeSystem,
    });

    return {
        initializeSystem: mutation.mutateAsync, // Async executor function for button click
        loading: mutation.isPending,             // Dynamic loading state flag
        result: mutation.data,                   // Backend return payload on success
        error: mutation.error?.response?.data?.message || mutation.error?.message || null,
    };
}