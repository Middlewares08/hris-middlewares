import { useNavigate } from 'react-router-dom'; // Or 'react-router-dom' depending on your routing setup
import { FileQuestion, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
    const navigate = useNavigate(); // If using react-router-dom, use: const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center select-none">
            
            {/* Animated Graphic Placeholder Matrix Asset */}
            <div className="relative mb-4">
                {/* Background ambient glow effect */}
                <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full scale-125" />
                
                {/* Floating Core Icon Wrapper Container */}
                <div className="w-24 h-24 bg-white border border-slate-200 text-slate-400 rounded-2xl flex items-center justify-center shadow-md relative animate-float">
                    <FileQuestion size={48} className="text-slate-500" />
                    
                    {/* Tiny sub-badge accent */}
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-xs">
                        404
                    </span>
                </div>
            </div>

            {/* Typography Context Labels */}
            <h1 className="text-4xl font-extrabold text-slate-800! tracking-tight mb-2">
                Page Not Found
            </h1>
            <p className="text-slate-500 max-w-sm text-sm leading-relaxed mb-4">
                The organizational workspace path, corporate directory matrix, or security asset you are trying to access does not exist or has been archived.
            </p>

            {/* Action Routing Operational Triggers */}
           <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-none justify-center mt-5">
                <button
                    onClick={() => navigate(-1)} // 🎯 Standard history stack step-back
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold transition-colors shadow-xs cursor-pointer"
                >
                    <ArrowLeft size={16} />
                    Go Back
                </button>
                
                <button
                    onClick={() => navigate('/dashboard')} // 🎯 Direct layout route jump
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-all shadow-xs cursor-pointer"
                >
                    <Home size={16} />
                    Return Dashboard
                </button>
            </div>
            
            {/* Minimalist Footnote Signature */}
            {/* <span className="text-[11px] font-mono tracking-widest text-slate-300 uppercase mt-16">
                System Endpoint Identity Error: NULL_ROUTE_TARGET
            </span> */}
        </div>
    );
}