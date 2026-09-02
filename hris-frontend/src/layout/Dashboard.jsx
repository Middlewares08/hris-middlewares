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
    Wallet,
    Megaphone,
    Clock,
    ScanFace,
    ListChecks,
    FileBarChart
} from 'lucide-react';
import { useLogout } from '../hooks/useLogout';
import Header from './Header';
import { can } from '../utils/permissionCheck';
import { usePendingEmployeeDocumentRequests } from '../hooks/useDocuments';
import { usePendingPayslipRequests } from '../hooks/usePayroll';

const DOCUMENTS_PATH = '/dashboard/employee/documents';
const PAYSLIP_REQUESTS_PATH = '/dashboard/payroll/payslip-requests';

const NavBadge = ({ count, className = '' }) => (
    count > 0 ? (
        <span className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-rose-700 px-1.5 text-[10px] font-bold leading-none text-white ${className}`}>
            {count > 9 ? '9+' : count}
        </span>
    ) : null
);

const Dashboard = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [openSubmenu, setOpenSubmenu] = useState(null);
    
    const navigate = useNavigate();
    const location = useLocation();
    const logout = useLogout();

    // Sidebar alert counts for pending requests employees have raised.
    const { data: pendingDocRequests = [] } = usePendingEmployeeDocumentRequests({ enabled: can('employee-documents:view') });
    const { data: pendingPayslipRequests = [] } = usePendingPayslipRequests({ enabled: can('run-payroll:view') });

    const badgeForPath = (path) => {
        if (path === DOCUMENTS_PATH) return pendingDocRequests.length;
        if (path === PAYSLIP_REQUESTS_PATH) return pendingPayslipRequests.length;
        return 0;
    };

    const menuBlueprint = [
        { 
            icon: <LayoutDashboard className='hover:cursor-pointer' size={20} />, 
            label: 'Dashboard', 
            path: '/dashboard', 
            permission: 'dashboard:view' 
        },
        {
            icon: <FileBarChart className='hover:cursor-pointer' size={20} />,
            label: 'Reports',
            path: '/dashboard/reports',
            permission: 'reports:view'
        },
        {
            icon: <GroupIcon className='hover:cursor-pointer' size={20}/>,
            label: 'Employee Directory',
            path: '/dashboard/employee', 
            permission: 'employee-management:view',
            children: [
                {
                    label: 'Employee',
                    path: '/dashboard/employee/lists',
                    permission: 'employee-management:view'
                },
                {
                    label: 'Departments',
                    path: '/dashboard/employee/departments',
                    permission: 'departments:view'
                },
                {
                    label: 'Position',
                    path: '/dashboard/employee/positions',
                    permission: 'positions:view'
                },
                {
                    label: 'Work Schedules',
                    path: '/dashboard/employee/work-schedules',
                    permission: 'shift-and-rostering:view'
                },
                {
                    label: 'Holiday Calendar',
                    path: '/dashboard/employee/holidays',
                    permission: 'shift-and-rostering:view'
                },
                // {
                //     label: 'Statutory & Compliance',
                //     path: '/dashboard/employee/statutory-and-compliance',
                //     permission: 'statutory-and-compliance:view'
                // },
                {
                    label: 'Documents',
                    path: '/dashboard/employee/documents',
                    permission: 'employee-documents:view'
                },
                {
                    label: 'Employee Compensation',
                    path: '/dashboard/employee/compensation',
                    permission: 'payroll-and-compensation:view'
                },
                {
                    label: 'Bank Details',
                    path: '/dashboard/employee/bank-details',
                    permission: 'payroll-and-compensation:view'
                }
            ]
        },
        {
            icon: <Wallet className='hover:cursor-pointer' size={20} />,
            label: 'Payroll',
            path: '/dashboard/payroll',
            children: [
                { label: 'Payroll Runs', path: '/dashboard/payroll/runs', permission: 'run-payroll:view' },
                { label: 'Payslip Requests', path: '/dashboard/payroll/payslip-requests', permission: 'run-payroll:view' },
                { label: 'Pay Periods', path: '/dashboard/payroll/periods', permission: 'run-payroll:view' },
                { label: 'Pay Components', path: '/dashboard/payroll/components', permission: 'payroll-and-compensation:view' },
                { label: 'Statutory Tables', path: '/dashboard/payroll/statutory-tables', permission: 'statutory-and-compliance:view' },
            ]
        },
        {
            icon: <Megaphone className='hover:cursor-pointer' size={20} />,
            label: 'Announcements',
            path: '/dashboard/announcements',
            permission: 'announcements:view',
        },
        {
            icon: <ListChecks className='hover:cursor-pointer' size={20} />,
            label: 'Attendance Logs',
            path: '/dashboard/attendance-logs',
            permission: 'attendance-logs:view',
        },
        {
            icon: <Clock className='hover:cursor-pointer' size={20} />,
            label: 'Overtime Tracker',
            path: '/dashboard/overtime',
            permission: 'overtime-tracker:view',
        },
        {
            icon: <ScanFace className='hover:cursor-pointer' size={20} />,
            label: 'Attendance Kiosk',
            path: '/dashboard/attendance-kiosk',
            permission: 'attendance-kiosk:view',
        },
        {
            icon: <Wrench className='hover:cursor-pointer' size={20} />,
            label: 'Maintenance',
            path: '/dashboard/maintenance', 
            permission: 'maintenance:view',
            children: [
                { 
                    label: 'Roles & Permission', 
                    path: '/dashboard/maintenance/roles-and-permission', 
                    permission: 'roles-and-permissions:view' 
                },
            ] 
        },
    ];

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
                                    className={`relative w-full flex items-center p-3 justify-center rounded-lg transition-all group hover:cursor-pointer
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
                                            // FIX: Check if current URL matches the path exactly OR starts with the path followed by a slash
                                            const isChildActive = location.pathname === child.path || location.pathname.startsWith(child.path + '/');
                                            
                                            return (
                                                <button
                                                    key={child.label}
                                                    onClick={() => navigate(child.path)}
                                                    className={`w-full flex items-center gap-2 text-left py-2 px-3 rounded-md text-sm transition-all hover:cursor-pointer
                                                        ${isChildActive
                                                            ? 'bg-gray-500 text-white'
                                                            : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'}`}
                                                >
                                                    <span className="flex-1 truncate">{child.label}</span>
                                                    <NavBadge count={badgeForPath(child.path)} />
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