import { Plane, CalendarRange, Users, Percent } from 'lucide-react';
import {
    PieChart, Pie, Cell, Tooltip, Legend,
} from 'recharts';
import { useReport } from '../../hooks/useReports';
import StatCard from '../../components/StatCard';
import ChartCard from '../../components/ChartCard';
import { CustomDataTable } from '../../components/CustomDataTable';
import ReportShell from './_shared/ReportShell';
import { useReportRange } from './_shared/useReportRange';
import { ReportSkeleton, seriesColor, fmtNum } from './_shared/bits';
import { TOOLTIP_STYLE, titleCase } from './_shared/chartTheme';
import { exportRowsToCsv } from './_shared/reportCsv';

function LeaveUtilizationReport() {
    const { range, setFrom, setTo, params } = useReportRange('ytd');
    const { data, isLoading, isFetching, error, refetch } = useReport('leave', params);

    const kpis = data?.kpis || {};
    const byType = data?.byType || [];
    const rows = data?.rows || [];
    const annualCredits = data?.annualCredits ?? 0;

    const handleExport = () => exportRowsToCsv('leave-utilisation', rows, [
        { key: 'employee', label: 'Employee' },
        { key: 'employeeNo', label: 'Employee No' },
        { key: 'department', label: 'Department' },
        { key: 'daysTaken', label: 'Total Days Taken' },
        { key: 'creditedDaysTaken', label: 'Credited Days Taken' },
        { key: 'creditsRemaining', label: 'Credits Remaining' },
        { key: 'utilisationRate', label: 'Utilisation %' },
    ]);

    return (
        <ReportShell
            title="Leave Utilisation"
            description={`Approved leave against the annual credit of ${annualCredits} days (vacation / sick / emergency draw from it).`}
            range={range}
            onFromChange={setFrom}
            onToChange={setTo}
            onExport={handleExport}
            canExport={rows.length > 0}
            isFetching={isFetching}
            error={error}
            onRetry={refetch}
        >
            {isLoading ? <ReportSkeleton /> : (
                <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard label="Total Days Taken" value={fmtNum(kpis.totalDaysTaken)} icon={CalendarRange} tone="blue" />
                        <StatCard label="Credited Days" value={fmtNum(kpis.creditedDaysTaken)} hint="Vacation / sick / emergency" icon={Plane} tone="violet" />
                        <StatCard label="Requests" value={fmtNum(kpis.requests)} icon={Percent} tone="slate" />
                        <StatCard label="Employees on Leave" value={fmtNum(kpis.employeesOnLeave)} icon={Users} tone="amber" />
                    </div>

                    <ChartCard title="Days by Leave Type" isEmpty={byType.length === 0}>
                        <PieChart>
                            <Tooltip contentStyle={TOOLTIP_STYLE} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Pie
                                data={byType}
                                dataKey="days"
                                nameKey="type"
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={90}
                                paddingAngle={2}
                                label={(e) => `${titleCase(e.type)} (${e.days})`}
                                labelLine={false}
                                style={{ fontSize: 11 }}
                            >
                                {byType.map((e, i) => (
                                    <Cell key={e.type} fill={seriesColor(i)} stroke="#fff" strokeWidth={2} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ChartCard>

                    <div>
                        <h3 className="mb-2 text-sm font-semibold text-slate-700">Per Employee</h3>
                        <CustomDataTable
                            data={rows}
                            isLoading={isFetching && rows.length === 0}
                            searchPlaceholder="Search employee or department..."
                            columns={[
                                { header: 'Employee', render: (r) => <div><div className="font-semibold text-slate-800">{r.employee}</div><div className="text-xs text-slate-400">{r.employeeNo || '—'}</div></div> },
                                { header: 'Department', render: (r) => r.department },
                                { header: 'Days Taken', render: (r) => fmtNum(r.daysTaken) },
                                { header: 'Credited', render: (r) => fmtNum(r.creditedDaysTaken) },
                                { header: 'Remaining', render: (r) => <span className={r.creditsRemaining < 0 ? 'text-rose-600' : 'text-emerald-600'}>{fmtNum(r.creditsRemaining)}</span> },
                                { header: 'Utilisation', render: (r) => `${fmtNum(r.utilisationRate)}%` },
                            ]}
                        />
                    </div>
                </div>
            )}
        </ReportShell>
    );
}

export default LeaveUtilizationReport;
