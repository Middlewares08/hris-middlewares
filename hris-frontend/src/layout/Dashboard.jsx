import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  ChevronLeft, 
  ChevronRight, 
  LayoutDashboard, 
  Package, 
  Wrench, 
  FileText, 
  CreditCard, 
  Users, 
  LogOut,
  ChevronDown,
  ShoppingCart,
  GroupIcon
} from 'lucide-react';
import { useLogout } from '../hooks/useLogout';
import Header from './Header';

const Dashboard = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    // Track which submenu is open (e.g., 'Products')
    const [openSubmenu, setOpenSubmenu] = useState(null);
    
    const navigate = useNavigate();
    const location = useLocation();
    const logout = useLogout();

    const menuItems = [
        { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/dashboard' },
        { icon: <GroupIcon size={20}/>, label: 'Employee', path: '/dashboard/employees'},
        { 
            icon: <Package size={20} />, 
            label: 'Products', 
            path: '/dashboard/products',
            children: [
                { label: 'Inventory', path: '/dashboard/products/inventory' },
                { label: 'Categories', path: '/dashboard/products/categories' },
            ]
        },
        { 
            icon: <Wrench size={20} />, 
            label: 'Services', 
            path: '/dashboard/services', 
            children: [
                { label: 'Services', path: '/dashboard/services/list' },
                { label: 'Categories', path: '/dashboard/services/categories' },
            ] 
        },
        { icon: <FileText size={20} />, label: 'Quotations', path: '/dashboard/quotations' },
        { icon: <CreditCard size={20} />, label: 'Payments', path: '/dashboard/payments' },
        { icon: <Users size={20} />, label: 'Customers', path: '/dashboard/users' },
        { icon: <Wrench size={20} />, 
            label: 'Maintenance', 
            path: '/dashboard/maintenance', 
            children: [
                { label: 'Roles & Permission', path: '/dashboard/maintenance/roles-and-permission' },
            ] 
        },
    ];

    const handleNavClick = (item) => {
        if (item.children) {
            // If it has children, toggle the submenu instead of immediate navigation
            if (isCollapsed) setIsCollapsed(false); // Auto-expand sidebar if clicking submenu
            setOpenSubmenu(openSubmenu === item.label ? null : item.label);
        } else {
            navigate(item.path);
            setOpenSubmenu(null); // Close submenus when navigating to a main link
        }
    };

    useEffect(() => {
        // Find the menu item that has children and matches the current URL
        const activeParent = menuItems.find(item => 
        item.children && location.pathname.startsWith(item.path)
        );

        if (activeParent) {
            setOpenSubmenu(activeParent.label);
        }
    }, [location.pathname]);

    return (
        <div className="w-full max-w-none min-h-screen bg-slate-900 text-white">
            {/* Sidebar */}
            <aside 
                className={`bg-black text-slate-300 transition-all duration-300 ease-in-out flex flex-col fixed inset-y-0 left-0 z-50
                ${isCollapsed ? 'w-20' : 'w-64'}`}
            >
                {/* Toggle Button */}
                <button
                    onClick={() => {
                        setIsCollapsed(!isCollapsed);
                        if (!isCollapsed) setOpenSubmenu(null); // Close submenus when collapsing
                    }}
                    className="absolute -right-3 top-12 bg-black text-white rounded-full p-1 border-2 border-slate-900 hover:scale-110 transition-transform z-[60]"
                >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>

                {/* Brand */}
                <div className="h-20 flex items-center px-6 mb-4">
                    <div className="w-8 h-8 bg-teal-500 rounded shrink-0 flex items-center justify-center text-white font-bold">
                        HR
                    </div>
                    {!isCollapsed && <span className="ml-4 text-xl font-bold text-white tracking-tight">HRIS</span>}
                </div>

                {/* Nav Links */}
                <nav className="flex-1 px-3 space-y-1 scrollbar-y-visible overflow-y-auto">
                    {menuItems.map((item) => {
                        // const isParentActive = location.pathname.startsWith(item.path);
                        // const isSubmenuOpen = openSubmenu === item.label;
                        const isParentActive = item.path === '/dashboard' 
                        ? location.pathname === '/dashboard' 
                        : location.pathname.startsWith(item.path);

                        const isSubmenuOpen = openSubmenu === item.label;

                        return (
                        <div key={item.label} className="flex flex-col">
                            <button
                                onClick={() => handleNavClick(item)}
                                className={`w-full flex items-center p-3 rounded-lg transition-all group
                                    ${isParentActive && !item.children ? 'bg-teal-700 text-white' : 'hover:bg-slate-800 hover:text-white'}
                                    ${isParentActive && item.children ? 'text-gray' : ''}`}
                            >
                                <span className={`${isParentActive ? 'text-teal-400' : 'text-slate-400 group-hover:text-teal-400'}`}>
                                    {item.icon}
                                </span>
                                
                                {!isCollapsed && (
                                    <>
                                    <span className="ml-4 font-medium truncate flex-1 text-left">{item.label}</span>
                                    {item.children && (
                                        <ChevronDown 
                                        size={16} 
                                        className={`transition-transform duration-200 ${isSubmenuOpen ? 'rotate-180' : ''}`} 
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
                                    className={`w-full text-left py-2 px-3 rounded-md text-sm transition-all
                                        ${isChildActive 
                                        ? 'text-teal-400 bg-teal-500/5 font-semibold' 
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
                        className="w-full flex items-center p-3 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                    >
                        <LogOut size={20} />
                        {!isCollapsed && <span className="ml-4 font-medium">Logout</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
           <main 
                className={`flex-1 transition-all duration-300 ease-in-out 
                ${isCollapsed ? 'ml-20' : 'ml-64'}`} // 💡 FIX: Dynamic left margin matches sidebar state
            >
                {/* Pass the real user data if you have it, otherwise this placeholder works */}
                <Header />
                
                {/* 💡 Additional tweak: changed max-w-screen to max-w-none so it uses the actual canvas space */}
                <div className="p-8 max-w-none mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Dashboard;