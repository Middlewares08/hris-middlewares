import { LoaderCircle } from 'lucide-react';

const Loading = ({ 
    size = "md", 
    fullPage = false, 
    text = "Loading...", 
    color = "gray" 
}) => {
    // Mapping sizes to Icon pixel values
    const sizes = {
        sm: 20,
        md: 32,
        lg: 48,
    };

    const loaderContent = (
        <div className="flex flex-col items-center justify-center gap-3">
            {/* The Icon replace the border div */}
            <LoaderCircle
                size={sizes[size]} 
                className={`animate-spin text-${color}-600`}
            />
            
            {text && (
                <div className='flex flex-col items-center'>
                    <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-slate-500 animate-pulse">
                        {text}
                    </p>
                     <span className="text-[9px] text-slate-400 font-medium">
                        Please wait..
                    </span>

                </div>
                
            )}
        </div>
    );

    if (fullPage) {
        return (
            <div className="fixed inset-0 z-9999 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                {loaderContent}
            </div>
        );
    }

    return (
        <div className="flex h-full w-full items-center justify-center p-4">
            {loaderContent}
        </div>
    );
};

export default Loading;