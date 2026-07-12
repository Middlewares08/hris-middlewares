// src/hooks/useAuth.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { authService } from '../services/authServices';
import { useNavigate } from 'react-router-dom';

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
        mutationFn: authService.verifyOtp,
        onSuccess: (data) => {
            // Your Axios response interceptor expects this token in localStorage
            localStorage.setItem('accessToken', data?.accessToken);
            // Securely redirect to your main dashboard page
            queryClient.setQueryData(['authUser'], data?.user);
            
            // set permission to session
            const rawPermissionsArray = data?.user?.permissions || []; // e.g., ['view', 'edit']

            // Convert array to a clean string, then encode it to Base64
            const encodedPermissions = btoa(JSON.stringify(rawPermissionsArray));

            sessionStorage.setItem('permissions', encodedPermissions);
            navigate('/dashboard');
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