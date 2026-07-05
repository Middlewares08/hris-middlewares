import { useQuery } from '@tanstack/react-query';
import { authService } from '../services/authServices';

export const useAuthUser = () => {
    // 💡 Read the token to see if a session is currently active
    const token = localStorage.getItem('accessToken');

    return useQuery({
        queryKey: ['authUser'],
        // Only run the API call if an access token actually exists on disk
        queryFn: authService.getCurrentProfile, 
        enabled: !!token, 
        staleTime: Infinity, // Keep this data fresh in memory permanently unless invalidated
        retry: false,
    });
};