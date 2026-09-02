import moment from 'moment';
import { TrendingDown, LogOut, ArrowRightLeft, Users } from 'lucide-react';
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

function TurnoverReport() {
    const { range, setFrom, setTo, params } = useReportRange('ytd');
    const { data, isLoading, isFetching, error, refetch } = useReport('turnover', params);

    const kpis = data?.kpis || {};
    const byType = data?.byType || [];
    const byDepartment = data?.byDepartment || [];
    const byMonth = (data?.byMonth || []).map((m) => ({ ...m, label: moment(`${m.month}-01`).format('MMM YY') }));

    const handleExport = () => exportRowsToCsv('turnover-by-department', byDepartment, [
        { key: 'department', label: 'Department' },
        { key: 'count', label: 'Separations' },
    ]);

    return (
        <ReportShell
            title="Employee Turnover"
            description="Separations, turnover rate and the voluntary / involuntary split for the selected period."
            range={range}
            onFromChange={setFrom}
            onToChange={setTo}
            onExport={handleExport}
            canExport={byDepartment.length > 0}
            isFetching={isFetching}
            error={error}
            onRetry={refetch}
        >
            {isLoading ? <ReportSkeleton /> : (
                <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard label="Turnover Rate" value={`${kpis.turnoverRate ?? 0}%`} hint="Separations / avg headcount" icon={TrendingDown} tone="rose" />
                        <StatCard label="Separations" value={fmtNum(kpis.separations)} icon={LogOut} tone="amber" />
                        <StatCard label="Voluntary" value={fmtNum(kpis.voluntary)} hint={`${fmtNum(kpis.involuntary)} involuntary`} icon={ArrowRightLeft} tone="blue" />
                        <StatCard label="Active Headcount" value={fmtNum(kpis.activeHeadcount)} icon={Users} tone="emerald" />
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <ChartCard title="Separations by Month" isEmpty={byMonth.length === 0}>
                            <BarChart data={byMonth} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
                                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                                <Bar dataKey="count" name="Separations" fill={C.red} radius={[4, 4, 0, 0]} maxBarSize={40}>
                                    <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: '#64748b' }} />
                                </Bar>
                            </BarChart>
                        </ChartCard>

                        <ChartCard title="Separations by Department" isEmpty={byDepartment.length === 0}>
                            <BarChart data={byDepartment} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                                <XAxis dataKey="department" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} interval={0} angle={-20} textAnchor="end" height={56} />
                                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                                <Bar dataKey="count" name="Separations" fill={C.orange} radius={[4, 4, 0, 0]} maxBarSize={48} />
                            </BarChart>
                        </ChartCard>
                    </div>

                    <div>
                        <h3 className="mb-2 text-sm font-semibold text-slate-700">By Reason Type</h3>
                        <CustomDataTable
                            data={byType}
                            isLoading={isFetching && byType.length === 0}
                            searchPlaceholder="Search type..."
                            columns={[
                                { header: 'Type', render: (r) => titleCase(r.type) },
                                { header: 'Count', render: (r) => fmtNum(r.count) },
                            ]}
                        />
                    </div>
                </div>
            )}
        </ReportShell>
    );
}

export default TurnoverReport;
