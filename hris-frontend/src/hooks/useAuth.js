// src/hooks/useAuth.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { authService } from '../services/authServices';
import { storePermissions, clearPermissions } from '../utils/permissionCheck';
import { useNavigate } from 'react-router-dom';

// The account must carry this to be allowed into the admin dashboard at all.
const CONSOLE_ACCESS = 'admin-console:access';

export function useAuth() {
    const [isVerifyOTP, setIsVerifyOTP] = useState(false);
    const [tempToken, setTempToken] = useState('');
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    // Password Verification Phase
    const loginMutation = useMutation({
        mutationFn: authService.login,
        onSuccess: (data) => {
            // Store the temporary token to send with the OTP code later
            setTempToken(data.token);
            // Flip the UI to show the OTP view layout state
            setIsVerifyOTP(true);
        },
    });

    // OTP Verification Phase
    const otpMutation = useMutation({
        mutationFn: async (payload) => {
            const data = await authService.verifyOtp(payload);
            const permissions = data?.user?.permissions || [];

            // Gate: reject accounts that aren't allowed into the admin dashboard.
            if (!permissions.includes(CONSOLE_ACCESS)) {
                const err = new Error("This account doesn't have access to the admin dashboard. Please use the employee app.");
                err.code = 'NO_CONSOLE_ACCESS';
                throw err;
            }
            return data;
        },
        onSuccess: (data) => {
            // Your Axios response interceptor expects this token in localStorage
            localStorage.setItem('accessToken', data?.accessToken);
            queryClient.setQueryData(['authUser'], data?.user);
            storePermissions(data?.user?.permissions || []);
            navigate('/dashboard');
        },
        onError: () => {
            // A denied gate check must not leave a half-authenticated session behind.
            localStorage.removeItem('accessToken');
            clearPermissions();
        },
    });

    // Clean error text parsing
    const getError = () => {
        const err = loginMutation.error || otpMutation.error;
        return err?.response?.data?.message || err?.message || null;
    };

    return {
        isVerifyOTP,
        login: loginMutation.mutateAsync,
        verifyOtp: otpMutation.mutateAsync,
        tempToken: tempToken,
        loading: loginMutation.isPending || otpMutation.isPending,
        error: getError(),
    };
}
