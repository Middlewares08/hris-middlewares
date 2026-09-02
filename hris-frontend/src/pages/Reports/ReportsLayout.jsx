import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { can } from '../../utils/permissionCheck';
import NotFound from '../../components/NotFound';

const VIEW = 'reports:view';

const GROUPS = [
    {
        label: 'Core',
        items: [
            { to: 'headcount', label: 'Headcount' },
            { to: 'attendance', label: 'Attendance' },
            { to: 'absence', label: 'Absence' },
            { to: 'leave', label: 'Leave Utilisation' },
        ],
    },
    {
        label: 'Workforce & Cost',
        items: [
            { to: 'overtime', label: 'Overtime' },
            { to: 'payroll', label: 'Payroll' },
            { to: 'turnover', label: 'Turnover' },
            { to: 'new-hires', label: 'New Hires' },
            { to: 'separations', label: 'Separations' },
        ],
    },
    {
        label: 'Rollups',
        items: [
            { to: 'departments', label: 'Department Stats' },
        ],
    },
    {
        label: 'Coming soon',
        items: [
            { to: 'performance', label: 'Performance' },
            { to: 'training', label: 'Training' },
        ],
    },
];

const tabClass = ({ isActive }) =>
    `whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
        isActive ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
    }`;

function ReportsLayout() {
    if (!can(VIEW)) return <NotFound />;

    return (
        <div className="mx-auto max-w-7xl space-y-5">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-white">
                    <BarChart3 size={18} />
                </div>
                <div>
                    <h1 className="text-lg font-bold text-slate-800">Reports</h1>
                    <p className="text-xs text-slate-400">HR analytics across headcount, attendance, leave, payroll and turnover.</p>
                </div>
            </div>

            <div className="space-y-2 border-b border-slate-100 pb-4">
                {GROUPS.map((group) => (
                    <div key={group.label} className="flex flex-wrap items-center gap-2">
                        <span className="w-28 shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            {group.label}
                        </span>
                        {group.items.map((item) => (
                            <NavLink key={item.to} to={item.to} className={tabClass}>
                                {item.label}
                            </NavLink>
                        ))}
                    </div>
                ))}
            </div>

            <Outlet />
        </div>
    );
}

export default ReportsLayout;
