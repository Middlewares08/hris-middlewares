import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
    ChevronLeft, 
    ChevronRight, 
    LayoutDashboard, 
    Wrench, 
    LogOut,
    ChevronDown,
    GroupIcon,
    CogIcon
} from 'lucide-react';
import { useLogout } from '../hooks/useLogout';
import Header from './Header';
// 🎯 UPDATE: Importing your exact utility function name
import { can } from '../utils/permissionCheck';

const Dashboard = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [openSubmenu, setOpenSubmenu] = useState(null);
    
    const navigate = useNavigate();
    const location = useLocation();
    const logout = useLogout();

    // 1. Raw layout blueprint structure containing checking rules
    const menuBlueprint = [
        { 
            icon: <LayoutDashboard className='hover:cursor-pointer' size={20} />, 
            label: 'Dashboard', 
            path: '/dashboard', 
            permission: 'dashboard:view' 
        },
        { 
            icon: <GroupIcon className='hover:cursor-pointer' size={20}/>, 
            label: 'Employee', 
            path: '/dashboard/employees', 
            permission: 'employee-management:view'
        },
        { 
            icon: <CogIcon className='hover:cursor-pointer' size={20}/>, 
            label: 'Lookups Setting', 
            path: '/dashboard/lookups', 
            permission: 'lookups-setting:view',
            children: [
                {
                    label: 'Departments', 
                    path: '/dashboard/lookups/departments', 
                    permission: 'departments:view' 
                }
            ]
        },
        { 
            icon: <Wrench className='hover:cursor-pointer' size={20} />, 
            label: 'Maintenance', 
            path: '/dashboard/maintenance', 
            permission: 'maintenance:view', // Optional parent node wrapper gate slug
            children: [
                { 
                    label: 'Roles & Permission', 
                    path: '/dashboard/maintenance/roles-and-permission', 
                    permission: 'roles-and-permissions:view' 
                },
            ] 
        },
    ];

    // 2. 🛡️ Dynamic filter pipeline step
    // Evaluates permissions line-by-line and strips out unauthorized nodes or links
    const menuItems = menuBlueprint
        .filter(item => !item.permission || can(item.permission))
        .map(item => {
            if (item.children) {
                return {
                    ...item,
                    children: item.children.filter(child => !child.permission || can(child.permission))
                };
            }
            return item;
        })
        // Remove parent nodes if all their children were stripped away by the filter
        .filter(item => !item.children || item.children.length > 0);

    const handleNavClick = (item) => {
        if (item.children) {
            if (isCollapsed) setIsCollapsed(false); 
            setOpenSubmenu(openSubmenu === item.label ? null : item.label);
        } else {
            navigate(item.path);
            setOpenSubmenu(null); 
        }
    };

    useEffect(() => {
        const activeParent = menuItems.find(item => 
            item.children && location.pathname.startsWith(item.path)
        );

        if (activeParent) {
            setOpenSubmenu(activeParent.label);
        }
    }, [location.pathname]);

    return (
        <div className="w-full max-w-none min-h-screen bg-gray-200 text-black">
            {/* Sidebar */}
            <aside 
                className={`bg-gray-700 text-slate-300 transition-all duration-300 ease-in-out flex flex-col fixed inset-y-0 left-0 z-50
                ${isCollapsed ? 'w-20' : 'w-64'}`}
            >
                {/* Toggle Button */}
                <button
                    onClick={() => {
                        setIsCollapsed(!isCollapsed);
                        if (!isCollapsed) setOpenSubmenu(null);
                    }}
                    className="absolute -right-3 top-12 bg-black text-white rounded-full p-1 border-2 border-slate-900 hover:scale-110 transition-transform z-[60]"
                >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>

                {/* Brand */}
                <div className="h-20 flex items-center px-6 mb-4">
                    <div className="w-8 h-8 bg-gray-500 rounded shrink-0 flex items-center justify-center text-white font-bold">
                        HR
                    </div>
                    {!isCollapsed && <span className="ml-4 text-xl font-bold text-white tracking-tight">HRIS</span>}
                </div>

                {/* Nav Links */}
                <nav className="flex-1 px-3 space-y-1 scrollbar-y-visible overflow-y-auto hover:cursor-pointer text-center">
                    {menuItems.map((item) => {
                        const isParentActive = item.path === '/dashboard' 
                            ? location.pathname === '/dashboard' 
                            : location.pathname.startsWith(item.path);

                        const isSubmenuOpen = openSubmenu === item.label;

                        return (
                            <div key={item.label} className="flex flex-col">
                                <button
                                    onClick={() => handleNavClick(item)}
                                    className={`w-full flex items-center p-3 justify-center rounded-lg transition-all group hover:cursor-pointer
                                        ${isParentActive && !item.children ? 'bg-gray-500 text-white' : 'hover:bg-slate-800 hover:text-white'}
                                        ${isParentActive && item.children ? 'text-gray' : ''}`}
                                >
                                    <span className={`${isParentActive ? 'text-gray-400' : 'text-slate-400 group-hover:text-gray-400'}`}>
                                        {item.icon}
                                    </span>
                                    
                                    {!isCollapsed && (
                                        <>
                                            <span className="ml-4 font-medium truncate flex-1 text-left hover:cursor-pointer">{item.label}</span>
                                            {item.children && (
                                                <ChevronDown 
                                                    size={16} 
                                                    className={`transition-transform duration-200 hover:cursor-pointer ${isSubmenuOpen ? 'rotate-180' : ''}`} 
                                                />
                                            )}
                                        </>
                                    )}
                                </button>

                                {/* Submenu Content */}
                                {!isCollapsed && item.children && isSubmenuOpen && (
                                    <div className="mt-1 ml-9 flex flex-col space-y-1 border-l border-slate-800 pl-2">
                                        {item.children.map((child) => {
                                            const isChildActive = location.pathname === child.path;
                                            return (
                                                <button
                                                    key={child.label}
                                                    onClick={() => navigate(child.path)}
                                                    className={`w-full text-left py-2 px-3 rounded-md text-sm transition-all hover:cursor-pointer
                                                        ${isChildActive 
                                                            ? 'font-semibold bg-gray-500 text-white' 
                                                            : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'}`}
                                                >
                                                    {child.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {/* Logout Button */}
                <div className="p-4 border-t border-slate-800">
                    <button 
                        onClick={logout}
                        className={"w-full flex hover:cursor-pointer items-center p-3 rounded-lg text-slate-400 hover:bg-red-500/30 hover:text-red-300 transition-colors " + (isCollapsed && 'justify-center')}
                    >
                        <LogOut size={20} />
                        {!isCollapsed && <span className="ml-4 font-medium">Logout</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
           <main 
                className={`flex-1 transition-all duration-300 ease-in-out 
                ${isCollapsed ? 'ml-20' : 'ml-64'}`}
            >
                <Header />
                
                <div className="px-8 py-4 max-w-none mx-auto text-black">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Dashboard;