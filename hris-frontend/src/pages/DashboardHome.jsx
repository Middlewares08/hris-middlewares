import moment from 'moment';
import {
    Users,
    UserPlus,
    CalendarCheck,
    Plane,
    FileClock,
    Timer,
    ShieldAlert,
    RefreshCw,
} from 'lucide-react';
import {
    BarChart,
    Bar,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    LabelList,
} from 'recharts';
import { can } from '../utils/permissionCheck';
import NotFound from '../components/NotFound';
import StatCard from '../components/StatCard';
import ChartCard from '../components/ChartCard';
import { useDashboardAnalytics } from '../hooks/useDashboard';

const VIEW = 'dashboard:view';

// Validated categorical palette (data-viz reference instance, light mode).
const C = {
    blue: '#2a78d6',
    orange: '#eb6834',
    aqua: '#1baf7a',
    yellow: '#eda100',
    magenta: '#e87ba4',
    violet: '#4a3aa7',
    green: '#008300',
    red: '#e34948',
};
const CATEGORICAL = [C.blue, C.orange, C.aqua, C.yellow, C.magenta, C.violet, C.green, C.red];

const AXIS_TICK = { fontSize: 11, fill: '#94a3b8' };
const GRID_STROKE = '#e2e8f0';
const TOOLTIP_STYLE = {
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    fontSize: 12,
    boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
};

const peso = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
});
const pesoCompact = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    notation: 'compact',
    maximumFractionDigits: 1,
});

const titleCase = (v) => String(v || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function Skeleton() {
    return (
        <div className="animate-pulse space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-24 rounded-xl border border-slate-200 bg-white" />
                ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-72 rounded-xl border border-slate-200 bg-white" />
                ))}
            </div>
        </div>
    );
}

function DashboardHome() {
    const allowed = can(VIEW);
    const { data, isLoading, error, refetch, isFetching } = useDashboardAnalytics({}, allowed);

    if (!allowed) return <NotFound />;

    if (isLoading) return <Skeleton />;

    if (error) {
        return (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <ShieldAlert size={18} className="mt-0.5 shrink-0" />
                <div>
                    <p className="font-semibold">Couldn&apos;t load dashboard analytics</p>
                    <p className="text-rose-600">{error}</p>
                    <button
                        type="button"
                        onClick={() => refetch()}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                    >
                        <RefreshCw size={12} /> Retry
                    </button>
                </div>
            </div>
        );
    }

    const kpis = data?.kpis || {};
    const headcountByDepartment = data?.headcountByDepartment || [];
    const attendanceTrend = data?.attendanceTrend || [];
    const leaveByType = data?.leaveByType || [];
    const payrollCostTrend = data?.payrollCostTrend || [];

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-bold text-slate-800">Overview</h1>
                    <p className="text-xs text-slate-400">
                        {data?.generatedAt
                            ? `Updated ${moment(data.generatedAt).format('MMM D, YYYY h:mm A')}`
                            : ''}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                    <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} /> Refresh
                </button>
            </div>

            {/* KPI tiles */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard label="Active Headcount" value={kpis.activeHeadcount ?? 0} icon={Users} tone="blue" />
                <StatCard label="New Hires" value={kpis.newHires30d ?? 0} hint="Last 30 days" icon={UserPlus} tone="emerald" />
                <StatCard
                    label="Attendance Rate"
                    value={`${kpis.attendanceRateToday ?? 0}%`}
                    hint="Clocked in today"
                    icon={CalendarCheck}
                    tone="violet"
                />
                <StatCard label="On Leave Today" value={kpis.onLeaveToday ?? 0} icon={Plane} tone="amber" />
                <StatCard label="Pending Leave" value={kpis.pendingLeave ?? 0} hint="Awaiting review" icon={FileClock} tone="amber" />
                <StatCard label="Pending Overtime" value={kpis.pendingOvertime ?? 0} hint="Awaiting review" icon={Timer} tone="rose" />
            </div>

            {/* Charts */}
            <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard
                    title="Headcount by Department"
                    subtitle="Active employees, by assigned department"
                    isEmpty={headcountByDepartment.length === 0}
                >
                    <BarChart data={headcountByDepartment} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                        <XAxis dataKey="department" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} interval={0} angle={-20} textAnchor="end" height={56} />
                        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                        <Bar dataKey="count" name="Employees" fill={C.blue} radius={[4, 4, 0, 0]} maxBarSize={48}>
                            <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: '#64748b' }} />
                        </Bar>
                    </BarChart>
                </ChartCard>

                <ChartCard
                    title={`Attendance Trend (${data?.windowDays ?? 14} days)`}
                    subtitle="Daily attendance logs by status"
                    isEmpty={attendanceTrend.length === 0}
                >
                    <AreaChart data={attendanceTrend} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                        <XAxis
                            dataKey="date"
                            tick={AXIS_TICK}
                            tickLine={false}
                            axisLine={{ stroke: GRID_STROKE }}
                            tickFormatter={(v) => moment(v).format('MMM D')}
                            minTickGap={16}
                        />
                        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => moment(v).format('ddd, MMM D')} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Area type="monotone" dataKey="present" name="Present" stackId="1" stroke={C.aqua} fill={C.aqua} fillOpacity={0.25} strokeWidth={2} />
                        <Area type="monotone" dataKey="late" name="Late" stackId="1" stroke={C.yellow} fill={C.yellow} fillOpacity={0.25} strokeWidth={2} />
                        <Area type="monotone" dataKey="absent" name="Absent" stackId="1" stroke={C.red} fill={C.red} fillOpacity={0.25} strokeWidth={2} />
                        <Area type="monotone" dataKey="on_leave" name="On Leave" stackId="1" stroke={C.blue} fill={C.blue} fillOpacity={0.25} strokeWidth={2} />
                    </AreaChart>
                </ChartCard>

                <ChartCard
                    title="Leave by Type"
                    subtitle="Requests filed in the last 90 days"
                    isEmpty={leaveByType.length === 0}
                >
                    <PieChart>
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Pie
                            data={leaveByType}
                            dataKey="count"
                            nameKey="type"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={90}
                            paddingAngle={2}
                            label={(entry) => `${titleCase(entry.type)} (${entry.count})`}
                            labelLine={false}
                            style={{ fontSize: 11 }}
                        >
                            {leaveByType.map((entry, i) => (
                                <Cell key={entry.type} fill={CATEGORICAL[i % CATEGORICAL.length]} stroke="#fff" strokeWidth={2} />
                            ))}
                        </Pie>
                    </PieChart>
                </ChartCard>

                <ChartCard
                    title="Payroll Cost Trend"
                    subtitle="Last 6 posted payroll runs"
                    isEmpty={payrollCostTrend.length === 0}
                >
                    <BarChart data={payrollCostTrend} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
                        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                        <XAxis dataKey="period" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} interval={0} angle={-20} textAnchor="end" height={56} />
                        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => pesoCompact.format(v)} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => peso.format(v)} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="gross" name="Gross" fill={C.blue} radius={[4, 4, 0, 0]} maxBarSize={28} />
                        <Bar dataKey="net" name="Net" fill={C.aqua} radius={[4, 4, 0, 0]} maxBarSize={28} />
                        <Bar dataKey="employerCost" name="Employer Cost" fill={C.orange} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                </ChartCard>
            </div>
        </div>
    );
}

export default DashboardHome;
