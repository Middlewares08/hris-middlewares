import { useQuery } from "@tanstack/react-query";
import { moduleServices } from "../services/moduleService";


export function useModules() {
    // 1. Fetch Query
    const moduleQuery = useQuery({
        queryKey: ['modules'],
        queryFn: moduleServices.getModuleTree,
    });

    return {
        // Core Grid Data & Global Fetch State
        modules: moduleQuery.data || [],
        isLoading: moduleQuery.isLoading,
        error: moduleQuery.error?.response?.data?.message || moduleQuery.error?.message || null,
        refetch: moduleQuery.refetch,
    }
}