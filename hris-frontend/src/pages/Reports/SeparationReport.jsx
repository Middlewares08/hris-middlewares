import { useState } from 'react';
import moment from 'moment';
import { LogOut, Plus, Clock3, Trash2 } from 'lucide-react';
import { useReport } from '../../hooks/useReports';
import { useSeparations } from '../../hooks/useSeparations';
import { can } from '../../utils/permissionCheck';
import StatCard from '../../components/StatCard';
import CustomButton from '../../components/CustomButton';
import CustomModal from '../../components/CustomModal';
import { CustomDataTable } from '../../components/CustomDataTable';
import ReportShell from './_shared/ReportShell';
import SeparationFormModal from './SeparationFormModal';
import { useReportRange } from './_shared/useReportRange';
import { ReportSkeleton, Tag, fmtNum } from './_shared/bits';
import { exportRowsToCsv } from './_shared/reportCsv';

const TYPE_TONE = {
    resignation: 'bg-blue-100 text-blue-700',
    termination: 'bg-rose-100 text-rose-700',
    end_of_contract: 'bg-amber-100 text-amber-700',
    retirement: 'bg-emerald-100 text-emerald-700',
    redundancy: 'bg-orange-100 text-orange-700',
    death: 'bg-slate-200 text-slate-600',
    other: 'bg-slate-100 text-slate-600',
};

function SeparationReport() {
    const { range, setFrom, setTo, params } = useReportRange('ytd');
    const { data, isLoading, isFetching, error, refetch } = useReport('separations', params);
    const { remove, isMutating } = useSeparations();

    const [showForm, setShowForm] = useState(false);
    const [toDelete, setToDelete] = useState(null);

    const kpis = data?.kpis || {};
    const rows = data?.rows || [];
    const canCreate = can('employee-management:create');
    const canDelete = can('employee-management:delete');

    const handleExport = () => exportRowsToCsv('separations', rows, [
        { key: 'employee', label: 'Employee' },
        { key: 'employeeNo', label: 'Employee No' },
        { key: 'department', label: 'Department' },
        { key: 'separationDate', label: 'Separation Date' },
        { key: 'type', label: 'Type' },
        { key: 'voluntary', label: 'Voluntary' },
        { key: 'tenureYears', label: 'Tenure (yrs)' },
        { key: 'reason', label: 'Reason' },
    ]);

    return (
        <ReportShell
            title="Resignation / Separation Report"
            description="Every recorded separation with reason, type and tenure."
            range={range}
            onFromChange={setFrom}
            onToChange={setTo}
            onExport={handleExport}
            canExport={rows.length > 0}
            isFetching={isFetching}
            error={error}
            onRetry={refetch}
            extraActions={canCreate ? (
                <CustomButton onClick={() => setShowForm(true)} icon={Plus} iconPosition="left" className="py-1.5! text-xs!">
                    Record separation
                </CustomButton>
            ) : null}
        >
            {isLoading ? <ReportSkeleton /> : (
                <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard label="Separations" value={fmtNum(kpis.total)} icon={LogOut} tone="amber" />
                        <StatCard label="Voluntary" value={fmtNum(kpis.voluntary)} icon={LogOut} tone="blue" />
                        <StatCard label="Involuntary" value={fmtNum(kpis.involuntary)} icon={LogOut} tone="rose" />
                        <StatCard label="Avg Tenure" value={`${fmtNum(kpis.avgTenureYears)} yrs`} icon={Clock3} tone="violet" />
                    </div>

                    <CustomDataTable
                        data={rows}
                        isLoading={isFetching && rows.length === 0}
                        searchPlaceholder="Search employee, department or reason..."
                        renderDrawerContent={canDelete ? (row, close) => (
                            <div className="mt-4 space-y-4">
                                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                    <p className="text-lg font-bold text-slate-900">{row.employee}</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <Tag value={row.type} tone={TYPE_TONE[row.type]} />
                                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                            {row.voluntary ? 'Voluntary' : 'Involuntary'}
                                        </span>
                                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                            {moment(row.separationDate).format('MMM D, YYYY')}
                                        </span>
                                    </div>
                                    {row.reason && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{row.reason}</p>}
                                    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                        <div><dt className="text-xs text-slate-400">Department</dt><dd>{row.department}</dd></div>
                                        <div><dt className="text-xs text-slate-400">Tenure</dt><dd>{row.tenureYears != null ? `${row.tenureYears} yrs` : '—'}</dd></div>
                                        <div><dt className="text-xs text-slate-400">Rehire eligible</dt><dd>{row.eligibleForRehire ? 'Yes' : 'No'}</dd></div>
                                    </dl>
                                </div>
                                <CustomButton
                                    icon={Trash2}
                                    iconPosition="left"
                                    onClick={() => { close(); setToDelete(row); }}
                                    className="w-full py-2 text-xs bg-white! text-rose-600! border border-rose-200 hover:bg-rose-50!"
                                >
                                    Remove & reinstate employee
                                </CustomButton>
                            </div>
                        ) : undefined}
                        columns={[
                            { header: 'Employee', render: (r) => <div><div className="font-semibold text-slate-800">{r.employee}</div><div className="text-xs text-slate-400">{r.employeeNo || '—'}</div></div> },
                            { header: 'Department', render: (r) => r.department },
                            { header: 'Date', render: (r) => moment(r.separationDate).format('MMM D, YYYY') },
                            { header: 'Type', render: (r) => <Tag value={r.type} tone={TYPE_TONE[r.type]} /> },
                            { header: 'Voluntary', render: (r) => (r.voluntary ? 'Yes' : 'No') },
                            { header: 'Tenure', render: (r) => (r.tenureYears != null ? `${r.tenureYears} yrs` : '—') },
                            { header: 'Reason', render: (r) => <span className="line-clamp-1 max-w-[24ch] text-sm text-slate-600">{r.reason || '—'}</span> },
                        ]}
                    />
                </div>
            )}

            <SeparationFormModal isOpen={showForm} onClose={() => setShowForm(false)} onSaved={refetch} />

            <CustomModal isOpen={!!toDelete} onClose={() => setToDelete(null)} title="Remove separation record?" size="md">
                <div className="p-2 text-center">
                    <p className="mb-6 text-sm text-slate-500 pb-4">
                        {toDelete && <>Remove <span className="font-semibold text-slate-800">{toDelete.employee}</span>&apos;s separation record? If they have no other active separation they will be set back to active.</>}
                    </p>
                    <div className="flex gap-3 border-t border-slate-100 pt-4">
                        <CustomButton onClick={() => setToDelete(null)} className="flex-1 py-2 border border-slate-200 bg-white! text-slate-700! hover:bg-slate-100! rounded-lg">Cancel</CustomButton>
                        <CustomButton
                            isLoading={isMutating}
                            className="flex-1 py-2 bg-rose-700 text-white rounded-lg text-sm font-medium hover:bg-rose-600"
                            onClick={async () => { try { await remove(toDelete.uuid); setToDelete(null); refetch(); } catch { /* handled */ } }}
                        >
                            Remove
                        </CustomButton>
                    </div>
                </div>
            </CustomModal>
        </ReportShell>
    );
}

export default SeparationReport;
