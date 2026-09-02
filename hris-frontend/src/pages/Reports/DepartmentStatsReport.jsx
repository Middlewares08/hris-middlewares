import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { useReport } from '../../hooks/useReports';
import ChartCard from '../../components/ChartCard';
import { CustomDataTable } from '../../components/CustomDataTable';
import ReportShell from './_shared/ReportShell';
import { useReportRange } from './_shared/useReportRange';
import { ReportSkeleton, fmtNum } from './_shared/bits';
import { C, AXIS_TICK, GRID_STROKE, TOOLTIP_STYLE } from './_shared/chartTheme';
import { exportRowsToCsv } from './_shared/reportCsv';

function DepartmentStatsReport() {
    const { range, setFrom, setTo, params } = useReportRange(30);
    const { data, isLoading, isFetching, error, refetch } = useReport('departments', params);

    const rows = data?.rows || [];

    const handleExport = () => exportRowsToCsv('department-statistics', rows, [
        { key: 'department', label: 'Department' },
        { key: 'headcount', label: 'Headcount' },
        { key: 'attendanceRate', label: 'Attendance %' },
        { key: 'leaveDays', label: 'Leave Days' },
        { key: 'separations', label: 'Separations' },
        { key: 'newHires', label: 'New Hires' },
    ]);

    return (
        <ReportShell
            title="Department Statistics"
            description="Headcount, attendance, leave, separations and new hires rolled up per department for the selected window."
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
                    <ChartCard title="Headcount vs New Hires vs Separations" isEmpty={rows.length === 0}>
                        <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                            <XAxis dataKey="department" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} interval={0} angle={-20} textAnchor="end" height={56} />
                            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey="headcount" name="Headcount" fill={C.blue} radius={[4, 4, 0, 0]} maxBarSize={26} />
                            <Bar dataKey="newHires" name="New Hires" fill={C.aqua} radius={[4, 4, 0, 0]} maxBarSize={26} />
                            <Bar dataKey="separations" name="Separations" fill={C.red} radius={[4, 4, 0, 0]} maxBarSize={26} />
                        </BarChart>
                    </ChartCard>

                    <CustomDataTable
                        data={rows}
                        isLoading={isFetching && rows.length === 0}
                        searchPlaceholder="Search department..."
                        columns={[
                            { header: 'Department', render: (r) => <span className="font-medium text-slate-800">{r.department}</span> },
                            { header: 'Headcount', render: (r) => fmtNum(r.headcount) },
                            { header: 'Attendance', render: (r) => `${fmtNum(r.attendanceRate)}%` },
                            { header: 'Leave Days', render: (r) => fmtNum(r.leaveDays) },
                            { header: 'Separations', render: (r) => <span className="text-rose-600">{fmtNum(r.separations)}</span> },
                            { header: 'New Hires', render: (r) => <span className="text-emerald-600">{fmtNum(r.newHires)}</span> },
                        ]}
                    />
                </div>
            )}
        </ReportShell>
    );
}

export default DepartmentStatsReport;
