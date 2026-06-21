import { User } from 'lucide-react'; // Make sure User is imported
import PropTypes from 'prop-types';
import { useQueryClient } from '@tanstack/react-query';

Header.PropTypes = {
    components: PropTypes.node
}

function Header (props) {
    const queryClient = useQueryClient();
    
    // 💡 Synchronously read the cached user data on render
    const user = queryClient.getQueryData(['authUser']);

    console.log('user: ', user);
    return (
        <header className="h-20 bg-teal-50/30 border-b border-teal-900/20 flex items-center justify-between px-8 w-full">
            {/* Left Side: Welcome Text */}
            <div className='flex gap-3'>
                <div className="w-10 h-10 bg-teal-100/50 rounded-full flex items-center justify-center border border-teal-200 cursor-pointer hover:bg-teal-200 transition-colors">
                    <User size={23} className="text-teal-700" />
                </div>
                <div>
                    <p className="flex text-xl font-bold label-teal leading-tight">
                        Welcome back, {user?.fullName || "User"}
                    </p>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                        {user?.email}
                    </p>
                </div>
            </div>

            {/* Right Side: User Profile Icon */}
            <div className="flex items-center">
                {
                    props?.components && props?.components
                }
                
            </div>
        </header>
    );
};

export default Header;