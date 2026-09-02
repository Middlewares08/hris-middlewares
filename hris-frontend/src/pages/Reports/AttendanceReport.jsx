import moment from 'moment';
import { CalendarCheck, Clock, UserX } from 'lucide-react';
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
import { C, AXIS_TICK, GRID_STROKE, TOOLTIP_STYLE, titleCase } from './_shared/chartTheme';
import { exportRowsToCsv } from './_shared/reportCsv';

const time = (v) => (v ? moment(v).format('h:mm A') : '—');

function AttendanceReport() {
    const { range, setFrom, setTo, params } = useReportRange(30);
    const { data, isLoading, isFetching, error, refetch } = useReport('attendance', params);

    const kpis = data?.kpis || {};
    const statusBreakdown = (data?.statusBreakdown || []).filter((s) => s.count > 0);
    const rows = data?.rows || [];

    const handleExport = () => exportRowsToCsv('attendance', rows, [
        { key: 'employee', label: 'Employee' },
        { key: 'employeeNo', label: 'Employee No' },
        { key: 'department', label: 'Department' },
        { key: 'presentDays', label: 'Present Days' },
        { key: 'lateDays', label: 'Late Days' },
        { key: 'absentDays', label: 'Absent Days' },
        { key: 'leaveDays', label: 'Leave Days' },
    ]);

    return (
        <ReportShell
            title="Attendance Report"
            description="Attendance rate, punctuality and per-employee daily-record counts for the selected window."
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
                        <StatCard label="Attendance Rate" value={`${kpis.attendanceRate ?? 0}%`} hint="Attended / scheduled (Mon–Fri)" icon={CalendarCheck} tone="emerald" />
                        <StatCard label="Punctuality" value={`${kpis.punctualityRate ?? 0}%`} hint="On-time / (on-time + late)" icon={Clock} tone="blue" />
                        <StatCard label="Late Logs" value={fmtNum(kpis.lateCount)} icon={Clock} tone="amber" />
                        <StatCard label="Absent Logs" value={fmtNum(kpis.absentCount)} icon={UserX} tone="rose" />
                    </div>

                    <ChartCard title="Daily Records by Status" subtitle={`${fmtNum(kpis.totalLogs)} logs in range`} isEmpty={statusBreakdown.length === 0}>
                        <BarChart data={statusBreakdown} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                            <XAxis dataKey="status" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} tickFormatter={titleCase} />
                            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(148,163,184,0.12)' }} labelFormatter={titleCase} />
                            <Bar dataKey="count" name="Logs" fill={C.blue} radius={[4, 4, 0, 0]} maxBarSize={56}>
                                <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: '#64748b' }} />
                            </Bar>
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
                                { header: 'Present', render: (r) => fmtNum(r.presentDays) },
                                { header: 'Late', render: (r) => <span className="text-amber-600">{fmtNum(r.lateDays)}</span> },
                                { header: 'Absent', render: (r) => <span className="text-rose-600">{fmtNum(r.absentDays)}</span> },
                                { header: 'Leave', render: (r) => fmtNum(r.leaveDays) },
                                { header: 'First In', render: (r) => time(r.firstIn) },
                                { header: 'Last Out', render: (r) => time(r.lastOut) },
                            ]}
                        />
                    </div>
                    <p className="text-xs text-slate-400">Undertime is measured during payroll — see the Payroll report.</p>
                </div>
            )}
        </ReportShell>
    );
}

export default AttendanceReport;
