// src/pages/ResetPassword.jsx
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lock, ShieldCheck } from 'lucide-react';
import CustomButton from '../components/CustomButton';
import CustomInput from '../components/CustomInput';
import { authService } from '../services/authServices';

const errMsg = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

function ResetPassword() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [formError, setFormError] = useState('');

    const mutation = useMutation({
        mutationFn: authService.resetPassword,
        onSuccess: () => {
            toast.success('Password set. You can now sign in.');
            navigate('/auth/login', { replace: true });
        },
    });

    const submit = (e) => {
        e.preventDefault();
        setFormError('');
        if (password.length < 8) {
            setFormError('Password must be at least 8 characters.');
            return;
        }
        if (password !== confirmPassword) {
            setFormError('Passwords do not match.');
            return;
        }
        mutation.mutate({ token, password });
    };

    if (!token) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
                <div className="bg-white rounded-2xl shadow-lg shadow-black/5 ring-1 ring-black/5 p-10 w-full max-w-sm text-center space-y-2">
                    <p className="text-lg font-semibold text-slate-900">Invalid link</p>
                    <p className="text-sm text-slate-500">This link is missing its token. Ask an admin to resend it.</p>
                </div>
            </div>
        );
    }

    const error = formError || (mutation.isError ? errMsg(mutation.error, 'Could not set your password.') : '');

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl shadow-lg shadow-black/5 ring-1 ring-black/5 p-10 w-full max-w-sm space-y-6">
                <div className="space-y-1 text-center">
                    <ShieldCheck size={28} className="mx-auto text-indigo-600" />
                    <p className="text-2xl font-semibold leading-snug text-slate-900">Set your password</p>
                    <p className="text-sm text-slate-500">Choose a password to finish activating your account.</p>
                </div>

                {error && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium p-3 rounded-lg text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={submit} className="space-y-4">
                    <CustomInput
                        label="New password"
                        labelPosition="left"
                        icon={Lock}
                        iconPosition="left"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        isRequired
                        placeholder="At least 8 characters"
                    />
                    <CustomInput
                        label="Confirm password"
                        labelPosition="left"
                        icon={Lock}
                        iconPosition="left"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        isRequired
                    />
                    <CustomButton type="submit" disabled={mutation.isPending} isLoading={mutation.isPending} variant="primary">
                        Set password
                    </CustomButton>
                </form>
            </div>
        </div>
    );
}

export default ResetPassword;
