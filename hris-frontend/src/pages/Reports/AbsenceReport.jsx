import { UserX, Users, Sigma } from 'lucide-react';
import moment from 'moment';
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
import { C, AXIS_TICK, GRID_STROKE, TOOLTIP_STYLE } from './_shared/chartTheme';
import { exportRowsToCsv } from './_shared/reportCsv';

function AbsenceReport() {
    const { range, setFrom, setTo, params } = useReportRange(30);
    const { data, isLoading, isFetching, error, refetch } = useReport('absence', params);

    const kpis = data?.kpis || {};
    const byDepartment = data?.byDepartment || [];
    const byDate = (data?.byDate || []).map((d) => ({ ...d, label: moment(d.date).format('MMM D') }));
    const rows = data?.rows || [];

    const handleExport = () => exportRowsToCsv('absence', rows, [
        { key: 'employee', label: 'Employee' },
        { key: 'employeeNo', label: 'Employee No' },
        { key: 'department', label: 'Department' },
        { key: 'absences', label: 'Absences' },
        { key: 'dates', label: 'Absence Dates' },
    ]);

    return (
        <ReportShell
            title="Absence Report"
            description="Unplanned absences by employee, department and date."
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
                    <div className="grid gap-4 sm:grid-cols-3">
                        <StatCard label="Total Absences" value={fmtNum(kpis.totalAbsences)} icon={UserX} tone="rose" />
                        <StatCard label="Employees Affected" value={fmtNum(kpis.employeesAffected)} icon={Users} tone="amber" />
                        <StatCard label="Avg / Employee" value={fmtNum(kpis.avgPerEmployee)} icon={Sigma} tone="slate" />
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <ChartCard title="Absences by Department" isEmpty={byDepartment.length === 0}>
                            <BarChart data={byDepartment} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                                <XAxis dataKey="department" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} interval={0} angle={-20} textAnchor="end" height={56} />
                                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                                <Bar dataKey="count" name="Absences" fill={C.red} radius={[4, 4, 0, 0]} maxBarSize={48}>
                                    <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: '#64748b' }} />
                                </Bar>
                            </BarChart>
                        </ChartCard>

                        <ChartCard title="Absences by Date" isEmpty={byDate.length === 0}>
                            <BarChart data={byDate} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} minTickGap={12} />
                                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                                <Bar dataKey="count" name="Absences" fill={C.orange} radius={[4, 4, 0, 0]} maxBarSize={28} />
                            </BarChart>
                        </ChartCard>
                    </div>

                    <div>
                        <h3 className="mb-2 text-sm font-semibold text-slate-700">Absentees</h3>
                        <CustomDataTable
                            data={rows}
                            isLoading={isFetching && rows.length === 0}
                            searchPlaceholder="Search employee or department..."
                            columns={[
                                { header: 'Employee', render: (r) => <div><div className="font-semibold text-slate-800">{r.employee}</div><div className="text-xs text-slate-400">{r.employeeNo || '—'}</div></div> },
                                { header: 'Department', render: (r) => r.department },
                                { header: 'Absences', render: (r) => <span className="font-semibold text-rose-600">{fmtNum(r.absences)}</span> },
                                { header: 'Dates', render: (r) => <span className="line-clamp-1 max-w-[36ch] text-xs text-slate-500">{r.dates.join(', ')}</span> },
                            ]}
                        />
                    </div>
                </div>
            )}
        </ReportShell>
    );
}

export default AbsenceReport;
