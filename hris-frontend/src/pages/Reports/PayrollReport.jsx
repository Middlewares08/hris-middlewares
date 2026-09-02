import moment from 'moment';
import { Wallet, Banknote, Landmark, Users } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
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

function LineList({ title, items, tone }) {
    if (!items?.length) return null;
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">{title}</h3>
            <ul className="divide-y divide-slate-100 text-sm">
                {items.map((l) => (
                    <li key={l.code || l.label} className="flex items-center justify-between py-1.5">
                        <span className="text-slate-600">{l.label}</span>
                        <span className={`font-semibold ${tone}`}>{peso.format(l.amount || 0)}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function PayrollReport() {
    const { range, setFrom, setTo, params } = useReportRange(90);
    const { data, isLoading, isFetching, error, refetch } = useReport('payroll', params);

    const kpis = data?.kpis || {};
    const impact = data?.attendanceImpact || {};
    const rows = (data?.rows || []).map((r) => ({ ...r, label: moment(r.payDate).format('MMM D') }));

    const handleExport = () => exportRowsToCsv('payroll', data?.rows || [], [
        { key: 'period', label: 'Period' },
        { key: 'payDate', label: 'Pay Date' },
        { key: 'status', label: 'Status' },
        { key: 'employees', label: 'Employees' },
        { key: 'gross', label: 'Gross' },
        { key: 'net', label: 'Net' },
        { key: 'taxable', label: 'Taxable' },
        { key: 'deductions', label: 'Deductions' },
        { key: 'employerCost', label: 'Employer Cost' },
    ]);

    return (
        <ReportShell
            title="Payroll Report"
            description="Posted payroll runs (calculated / approved / paid) with pay date in the selected window."
            range={range}
            onFromChange={setFrom}
            onToChange={setTo}
            onExport={handleExport}
            canExport={(data?.rows || []).length > 0}
            isFetching={isFetching}
            error={error}
            onRetry={refetch}
        >
            {isLoading ? <ReportSkeleton /> : (
                <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard label="Gross Pay" value={peso.format(kpis.totalGross || 0)} hint={`${fmtNum(kpis.runs)} run(s)`} icon={Wallet} tone="blue" />
                        <StatCard label="Net Pay" value={peso.format(kpis.totalNet || 0)} icon={Banknote} tone="emerald" />
                        <StatCard label="Deductions" value={peso.format(kpis.totalDeductions || 0)} icon={Landmark} tone="rose" />
                        <StatCard label="Employer Cost" value={peso.format(kpis.totalEmployerCost || 0)} hint={`${fmtNum(kpis.payslips)} payslips`} icon={Users} tone="amber" />
                    </div>

                    <ChartCard title="Gross / Net / Employer Cost by Run" isEmpty={rows.length === 0}>
                        <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
                            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} interval={0} angle={-20} textAnchor="end" height={56} />
                            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => pesoCompact.format(v)} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => peso.format(v)} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey="gross" name="Gross" fill={C.blue} radius={[4, 4, 0, 0]} maxBarSize={26} />
                            <Bar dataKey="net" name="Net" fill={C.aqua} radius={[4, 4, 0, 0]} maxBarSize={26} />
                            <Bar dataKey="employerCost" name="Employer Cost" fill={C.orange} radius={[4, 4, 0, 0]} maxBarSize={26} />
                        </BarChart>
                    </ChartCard>

                    <div className="grid gap-4 lg:grid-cols-3">
                        <LineList title="Earnings" items={data?.earnings} tone="text-emerald-600" />
                        <LineList title="Deductions" items={data?.deductions} tone="text-rose-600" />
                        <LineList title="Employer Contributions" items={data?.employerContributions} tone="text-slate-700" />
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                        <span className="font-semibold text-slate-700">Attendance impact:</span>{' '}
                        {fmtNum(impact.lateMinutes)} late min · {fmtNum(impact.undertimeMinutes)} undertime min · {fmtNum(impact.overtimeHours)} OT hrs
                    </div>

                    <div>
                        <h3 className="mb-2 text-sm font-semibold text-slate-700">Runs</h3>
                        <CustomDataTable
                            data={data?.rows || []}
                            isLoading={isFetching && (data?.rows || []).length === 0}
                            searchPlaceholder="Search period..."
                            columns={[
                                { header: 'Period', render: (r) => <div><div className="font-semibold text-slate-800">{r.period}</div><div className="text-xs text-slate-400 capitalize">{r.status} · {String(r.runType).replace(/_/g, ' ')}</div></div> },
                                { header: 'Pay Date', render: (r) => moment(r.payDate).format('MMM D, YYYY') },
                                { header: 'Employees', render: (r) => fmtNum(r.employees) },
                                { header: 'Gross', render: (r) => peso.format(r.gross || 0) },
                                { header: 'Net', render: (r) => peso.format(r.net || 0) },
                                { header: 'Deductions', render: (r) => peso.format(r.deductions || 0) },
                                { header: 'Employer Cost', render: (r) => peso.format(r.employerCost || 0) },
                            ]}
                        />
                    </div>
                </div>
            )}
        </ReportShell>
    );
}

export default PayrollReport;
