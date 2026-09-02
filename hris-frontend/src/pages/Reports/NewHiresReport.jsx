import moment from 'moment';
import { UserPlus, Building2, Briefcase } from 'lucide-react';
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

function NewHiresReport() {
    const { range, setFrom, setTo, params } = useReportRange(90);
    const { data, isLoading, isFetching, error, refetch } = useReport('new-hires', params);

    const kpis = data?.kpis || {};
    const byDepartment = data?.byDepartment || [];
    const byMonth = (data?.byMonth || []).map((m) => ({ ...m, label: moment(`${m.month}-01`).format('MMM YY') }));
    const rows = data?.rows || [];

    const handleExport = () => exportRowsToCsv('new-hires', rows, [
        { key: 'employee', label: 'Employee' },
        { key: 'employeeNo', label: 'Employee No' },
        { key: 'department', label: 'Department' },
        { key: 'position', label: 'Position' },
        { key: 'employmentType', label: 'Employment Type' },
        { key: 'dateHired', label: 'Date Hired' },
    ]);

    return (
        <ReportShell
            title="New Hires Report"
            description="Employees with a hire date in the selected window."
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
                        <StatCard label="New Hires" value={fmtNum(kpis.newHires)} icon={UserPlus} tone="emerald" />
                        <StatCard label="Departments" value={fmtNum(byDepartment.length)} icon={Building2} tone="blue" />
                        <StatCard label="Positions" value={fmtNum((data?.byPosition || []).length)} icon={Briefcase} tone="violet" />
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <ChartCard title="Hires by Month" isEmpty={byMonth.length === 0}>
                            <BarChart data={byMonth} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
                                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                                <Bar dataKey="count" name="Hires" fill={C.aqua} radius={[4, 4, 0, 0]} maxBarSize={40}>
                                    <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: '#64748b' }} />
                                </Bar>
                            </BarChart>
                        </ChartCard>

                        <ChartCard title="Hires by Department" isEmpty={byDepartment.length === 0}>
                            <BarChart data={byDepartment} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} interval={0} angle={-20} textAnchor="end" height={56} />
                                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                                <Bar dataKey="count" name="Hires" fill={C.blue} radius={[4, 4, 0, 0]} maxBarSize={48} />
                            </BarChart>
                        </ChartCard>
                    </div>

                    <div>
                        <h3 className="mb-2 text-sm font-semibold text-slate-700">New Hires</h3>
                        <CustomDataTable
                            data={rows}
                            isLoading={isFetching && rows.length === 0}
                            searchPlaceholder="Search employee, department or position..."
                            columns={[
                                { header: 'Employee', render: (r) => <div><div className="font-semibold text-slate-800">{r.employee}</div><div className="text-xs text-slate-400">{r.employeeNo || '—'}</div></div> },
                                { header: 'Department', render: (r) => r.department },
                                { header: 'Position', render: (r) => titleCase(r.position) },
                                { header: 'Type', render: (r) => titleCase(r.employmentType) },
                                { header: 'Date Hired', render: (r) => moment(r.dateHired).format('MMM D, YYYY') },
                            ]}
                        />
                    </div>
                </div>
            )}
        </ReportShell>
    );
}

export default NewHiresReport;
