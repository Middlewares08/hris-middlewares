import moment from 'moment';
import { Timer, Coins, Users, FileClock } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from 'recharts';
import { useReport } from '../../hooks/useReports';
import StatCard from '../../components/StatCard';
import ChartCard from '../../components/ChartCard';
import { CustomDataTable } from '../../components/CustomDataTable';
import ReportShell from './_shared/ReportShell';
import { useReportRange } from './_shared/useReportRange';
import { ReportSkeleton, fmtNum } from './_shared/bits';
import {
    C, AXIS_TICK, GRID_STROKE, TOOLTIP_STYLE, peso, pesoCompact,
} from './_shared/chartTheme';
import { exportRowsToCsv } from './_shared/reportCsv';

function OvertimeReport() {
    const { range, setFrom, setTo, params } = useReportRange(30);
    const { data, isLoading, isFetching, error, refetch } = useReport('overtime', params);

    const kpis = data?.kpis || {};
    const byDepartment = data?.byDepartment || [];
    const byDate = (data?.byDate || []).map((d) => ({ ...d, label: moment(d.date).format('MMM D') }));
    const rows = data?.rows || [];

    const handleExport = () => exportRowsToCsv('overtime', rows, [
        { key: 'employee', label: 'Employee' },
        { key: 'employeeNo', label: 'Employee No' },
        { key: 'department', label: 'Department' },
        { key: 'hours', label: 'OT Hours' },
        { key: 'filings', label: 'Filings' },
        { key: 'hourlyRate', label: 'Hourly Rate' },
        { key: 'estimatedCost', label: 'Estimated OT Cost' },
    ]);

    return (
        <ReportShell
            title="Overtime Report"
            description="Approved overtime hours and estimated cost (hours × hourly rate × 1.25) by employee and department."
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
                        <StatCard label="Total OT Hours" value={fmtNum(kpis.totalHours)} icon={Timer} tone="blue" />
                        <StatCard label="Estimated Cost" value={peso.format(kpis.estimatedCost || 0)} icon={Coins} tone="amber" />
                        <StatCard label="Employees" value={fmtNum(kpis.employees)} icon={Users} tone="violet" />
                        <StatCard label="Filings" value={fmtNum(kpis.filings)} icon={FileClock} tone="slate" />
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <ChartCard title="OT Hours by Department" isEmpty={byDepartment.length === 0}>
                            <BarChart data={byDepartment} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                                <XAxis dataKey="department" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} interval={0} angle={-20} textAnchor="end" height={56} />
                                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={32} />
                                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                                <Bar dataKey="hours" name="Hours" fill={C.blue} radius={[4, 4, 0, 0]} maxBarSize={48}>
                                    <LabelList dataKey="hours" position="top" style={{ fontSize: 11, fill: '#64748b' }} />
                                </Bar>
                            </BarChart>
                        </ChartCard>

                        <ChartCard title="OT Cost by Department" isEmpty={byDepartment.length === 0}>
                            <BarChart data={byDepartment} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
                                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                                <XAxis dataKey="department" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} interval={0} angle={-20} textAnchor="end" height={56} />
                                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => pesoCompact.format(v)} />
                                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => peso.format(v)} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                                <Bar dataKey="cost" name="Estimated Cost" fill={C.orange} radius={[4, 4, 0, 0]} maxBarSize={48} />
                            </BarChart>
                        </ChartCard>
                    </div>

                    <ChartCard title="OT Hours by Date" isEmpty={byDate.length === 0} height={220}>
                        <BarChart data={byDate} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} minTickGap={12} />
                            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={32} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                            <Bar dataKey="hours" name="Hours" fill={C.aqua} radius={[4, 4, 0, 0]} maxBarSize={24} />
                        </BarChart>
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
                                { header: 'Hours', render: (r) => fmtNum(r.hours) },
                                { header: 'Filings', render: (r) => fmtNum(r.filings) },
                                { header: 'Hourly Rate', render: (r) => peso.format(r.hourlyRate || 0) },
                                { header: 'Est. Cost', render: (r) => <span className="font-semibold text-slate-800">{peso.format(r.estimatedCost || 0)}</span> },
                            ]}
                        />
                    </div>
                    <p className="text-xs text-slate-400">Cost is an estimate — hourly rate is derived from each employee&apos;s active compensation; unpaid or unrated employees show ₱0.</p>
                </div>
            )}
        </ReportShell>
    );
}

export default OvertimeReport;
