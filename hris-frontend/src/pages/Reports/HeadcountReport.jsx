import { Users, UserCheck, UserX, Building2 } from 'lucide-react';
import {
    BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList,
} from 'recharts';
import { useReport } from '../../hooks/useReports';
import StatCard from '../../components/StatCard';
import ChartCard from '../../components/ChartCard';
import { CustomDataTable } from '../../components/CustomDataTable';
import ReportShell from './_shared/ReportShell';
import { ReportSkeleton, seriesColor, fmtNum } from './_shared/bits';
import { C, AXIS_TICK, GRID_STROKE, TOOLTIP_STYLE, titleCase } from './_shared/chartTheme';
import { exportRowsToCsv } from './_shared/reportCsv';

function HeadcountReport() {
    const { data, isLoading, isFetching, error, refetch } = useReport('headcount');

    const kpis = data?.kpis || {};
    const byDepartment = data?.byDepartment || [];
    const byPosition = data?.byPosition || [];
    const byEmploymentType = data?.byEmploymentType || [];

    const handleExport = () => exportRowsToCsv('headcount-by-position', byPosition, [
        { key: 'position', label: 'Position' },
        { key: 'count', label: 'Employees' },
    ]);

    return (
        <ReportShell
            title="Employee Headcount"
            description="Active workforce snapshot — by department, position and employment type."
            range={null}
            onExport={handleExport}
            canExport={byPosition.length > 0}
            isFetching={isFetching}
            error={error}
            onRetry={refetch}
        >
            {isLoading ? <ReportSkeleton /> : (
                <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard label="Total Employees" value={fmtNum(kpis.total)} icon={Users} tone="blue" />
                        <StatCard label="Active" value={fmtNum(kpis.active)} icon={UserCheck} tone="emerald" />
                        <StatCard label="Inactive" value={fmtNum(kpis.inactive)} icon={UserX} tone="rose" />
                        <StatCard label="Departments" value={fmtNum(kpis.departments)} icon={Building2} tone="violet" />
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <ChartCard title="Headcount by Department" isEmpty={byDepartment.length === 0}>
                            <BarChart data={byDepartment} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                                <XAxis dataKey="department" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} interval={0} angle={-20} textAnchor="end" height={56} />
                                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                                <Bar dataKey="count" name="Employees" fill={C.blue} radius={[4, 4, 0, 0]} maxBarSize={48}>
                                    <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: '#64748b' }} />
                                </Bar>
                            </BarChart>
                        </ChartCard>

                        <ChartCard title="By Employment Type" isEmpty={byEmploymentType.length === 0}>
                            <PieChart>
                                <Tooltip contentStyle={TOOLTIP_STYLE} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Pie
                                    data={byEmploymentType}
                                    dataKey="count"
                                    nameKey="type"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={90}
                                    paddingAngle={2}
                                    label={(e) => `${titleCase(e.type)} (${e.count})`}
                                    labelLine={false}
                                    style={{ fontSize: 11 }}
                                >
                                    {byEmploymentType.map((e, i) => (
                                        <Cell key={e.type} fill={seriesColor(i)} stroke="#fff" strokeWidth={2} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ChartCard>
                    </div>

                    <div>
                        <h3 className="mb-2 text-sm font-semibold text-slate-700">Headcount by Position</h3>
                        <CustomDataTable
                            data={byPosition}
                            isLoading={isFetching && byPosition.length === 0}
                            searchPlaceholder="Search positions..."
                            columns={[
                                { header: 'Position', render: (r) => <span className="font-medium text-slate-800">{titleCase(r.position)}</span> },
                                { header: 'Employees', render: (r) => fmtNum(r.count) },
                            ]}
                        />
                    </div>
                </div>
            )}
        </ReportShell>
    );
}

export default HeadcountReport;
