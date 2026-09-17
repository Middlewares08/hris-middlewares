// src/components/Login.jsx
import { Lock, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import CustomButton from "../components/CustomButton";
import CustomInput from "../components/CustomInput";
import ContactAdminModal from "../components/ContactAdminModal";

function Login() {
    // Pull our centralized architectural states
    const { isVerifyOTP, login, verifyOtp, loading, error, tempToken } = useAuth();

    // Controlled form inputs (initialized with safe empty strings)
    const [payload, setPayload] = useState({ email: "", password: "" });
    const [otpCode, setOtpCode] = useState("");
    const [contactOpen, setContactOpen] = useState(false);

    const onChangeFields = (field, value) => {
        setPayload(prev => ({ ...prev, [field]: value }));
    };

    // Execution handler for email + password submit
    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        await login(payload);
    };

    // Execution handler for the second verification factor step
    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        // Re-pack variables into format required by authRoutes validator
        await verifyOtp({ token: tempToken, otp: otpCode, email: payload?.email }); // 'admin@hris.local'
        
    };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center h-[80vh]">
        <ContactAdminModal
            isOpen={contactOpen}
            onClose={() => setContactOpen(false)}
            source="admin-console · login"
        />
        <div className="bg-white rounded-2xl shadow-lg shadow-black/5 ring-1 ring-black/5 p-10 w-full max-w-sm space-y-6">
            <div className="space-y-1 text-center">
                <p className="text-2xl font-semibold leading-snug text-slate-900">Welcome to HRIS Middleware</p>
                <p className="text-sm text-slate-500">
                    {isVerifyOTP ? "Enter your 2FA verification code" : "Sign in to continue"}
                </p>
            </div>

            {/* Global Operational Error UI Toast wrapper */}
            {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium p-3 rounded-lg text-center">
                    {error}
                </div>
            )}

            {!isVerifyOTP ? (
            /* PHASE 1: EMAIL & PASSWORD VIEW */
            <>
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-slate-700">Email</label>
                        <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
                            <Mail size={16} className="text-gray-400" />
                            <input
                                value={payload.email}
                                type="email"
                                required
                                onChange={(e) => onChangeFields('email', e.target.value)}
                                placeholder="you@example.com"
                                className="w-full bg-transparent outline-none text-sm text-gray-700 placeholder-gray-400"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-slate-700">Password</label>
                        <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
                            <Lock size={16} className="text-gray-400" />
                            <input
                                value={payload.password}
                                type="password"
                                required
                                onChange={(e) => onChangeFields('password', e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-transparent outline-none text-sm text-gray-700 placeholder-gray-400"
                            />
                        </div>
                    </div>

                    <button 
                        disabled={loading} 
                        className="w-full flex py-2.5 justify-center bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:bg-slate-400 cursor-pointer" 
                        type="submit"
                    >
                        {loading ? 'Verifying profile...' : 'Sign In'}
                    </button>
                </form>

                <div className="flex justify-between text-xs pt-2">
                    <a href="#" className="text-slate-500 hover:text-slate-900 transition-colors">Forgot password?</a>
                    <button
                        type="button"
                        onClick={() => setContactOpen(true)}
                        className="text-slate-500 hover:text-slate-900 transition-colors"
                    >
                        Need help? <span className="text-slate-900 font-medium">Contact an admin</span>
                    </button>
                </div>
            </>
            ) : (
                /* PHASE 2: SECURITY OTP VALIDATION VIEW */
                <form onSubmit={handleOtpSubmit} className="space-y-4">
                    <CustomInput
                        label="One-Time Code"
                        labelPosition='left'
                        icon={ShieldCheck}
                        iconPosition="left"
                        type="text"
                        value={otpCode}
                        isRequired={true}
                        maxLength={6}
                        placeholder="000000"
                        onChange={(e) => setOtpCode(e.target.value)}
                        inputClassName="tracking-widest placeholder:tracking-normal font-mono"
                    />
                    
                    <CustomButton 
                        children={loading ? 'Confirming code...' : 'Confirm Authentication'}
                        type='submit'
                        disabled={loading} 
                        isLoading={loading}
                        variant='primary'
                    />
                </form>
            )}
        </div>
    </div>
  );
}

export default Login;