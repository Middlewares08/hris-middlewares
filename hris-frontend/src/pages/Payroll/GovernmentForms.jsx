import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import moment from 'moment';
import {
    Landmark, FileDown, ShieldAlert, AlertTriangle, CheckCircle2, Users, Wallet,
    Building2, FileText, Loader2, Download,
} from 'lucide-react';
import { CustomDataTable } from '../../components/CustomDataTable';
import CustomDropdown from '../../components/CustomDropdown';
import CustomLabel from '../../components/CustomLabel';
import CustomButton from '../../components/CustomButton';
import StatCard from '../../components/StatCard';
import NotFound from '../../components/NotFound';
import { can } from '../../utils/permissionCheck';
import { useGovFormCatalogue, useGovFormPreview, downloadGovForm } from '../../hooks/useGovForms';

const VIEW = 'government-forms:view';

const peso = (v) => `₱${(Number(v) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const AGENCY_TONE = {
    BIR: 'bg-rose-50 text-rose-600 border-rose-200',
    SSS: 'bg-sky-50 text-sky-600 border-sky-200',
    PhilHealth: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    'Pag-IBIG': 'bg-amber-50 text-amber-600 border-amber-200',
};

// Per-form preview table columns + KPI tiles.
const VIEWS = {
    'sss-r3': {
        totals: (t) => [
            ['Members', t.employees, Users, 'slate'],
            ['EE Share', peso(t.sss?.ee), Wallet, 'blue'],
            ['ER Share', peso(t.sss?.er), Wallet, 'emerald'],
            ['Total (EE+ER+EC)', peso(t.sss?.total), Landmark, 'violet'],
        ],
        columns: [
            { header: 'Employee', render: (r) => <span className="font-medium text-slate-800">{r.fullName}</span> },
            { header: 'SSS No.', render: (r) => <span className="font-mono text-xs">{r.sssNo || <em className="text-rose-500">missing</em>}</span> },
            { header: 'MSC', render: (r) => peso(r.sss?.msc) },
            { header: 'EE', render: (r) => peso(r.sss?.ee) },
            { header: 'ER', render: (r) => peso(r.sss?.er) },
            { header: 'EC', render: (r) => peso(r.sss?.ec) },
            { header: 'Total', render: (r) => <span className="font-semibold">{peso(r.sss?.total)}</span> },
        ],
    },
    'philhealth-rf1': {
        totals: (t) => [
            ['Members', t.employees, Users, 'slate'],
            ['Personal Share', peso(t.philhealth?.ee), Wallet, 'blue'],
            ['Employer Share', peso(t.philhealth?.er), Wallet, 'emerald'],
            ['Total Premium', peso(t.philhealth?.total), Landmark, 'violet'],
        ],
        columns: [
            { header: 'Employee', render: (r) => <span className="font-medium text-slate-800">{r.fullName}</span> },
            { header: 'PhilHealth No.', render: (r) => <span className="font-mono text-xs">{r.philhealthNo || <em className="text-rose-500">missing</em>}</span> },
            { header: 'Salary Base', render: (r) => peso(r.philhealth?.base) },
            { header: 'Personal', render: (r) => peso(r.philhealth?.ee) },
            { header: 'Employer', render: (r) => peso(r.philhealth?.er) },
            { header: 'Total', render: (r) => <span className="font-semibold">{peso(r.philhealth?.total)}</span> },
        ],
    },
    'pagibig-mcrf': {
        totals: (t) => [
            ['Members', t.employees, Users, 'slate'],
            ['EE Share', peso(t.pagibig?.ee), Wallet, 'blue'],
            ['ER Share', peso(t.pagibig?.er), Wallet, 'emerald'],
            ['Total', peso(t.pagibig?.total), Landmark, 'violet'],
        ],
        columns: [
            { header: 'Employee', render: (r) => <span className="font-medium text-slate-800">{r.fullName}</span> },
            { header: 'Pag-IBIG MID', render: (r) => <span className="font-mono text-xs">{r.pagibigNo || <em className="text-rose-500">missing</em>}</span> },
            { header: 'Monthly Comp', render: (r) => peso(r.pagibig?.base) },
            { header: 'EE', render: (r) => peso(r.pagibig?.ee) },
            { header: 'ER', render: (r) => peso(r.pagibig?.er) },
            { header: 'Total', render: (r) => <span className="font-semibold">{peso(r.pagibig?.total)}</span> },
        ],
    },
    'bir-2316': {
        totals: (t) => [
            ['Employees', t.employees, Users, 'slate'],
            ['Gross Comp', peso(t.grossCompensation), Wallet, 'blue'],
            ['Taxable', peso(t.taxableCompensation), Wallet, 'amber'],
            ['Tax Withheld', peso(t.taxWithheld), Landmark, 'violet'],
        ],
        columns: [
            { header: 'Employee', render: (r) => <span className="font-medium text-slate-800">{r.fullName}</span> },
            { header: 'TIN', render: (r) => <span className="font-mono text-xs">{r.tin || <em className="text-rose-500">missing</em>}</span> },
            { header: 'Months', render: (r) => r.monthsWorked },
            { header: 'Gross', render: (r) => peso(r.grossCompensation) },
            { header: 'Taxable', render: (r) => peso(r.taxableCompensation) },
            { header: 'Tax Due', render: (r) => peso(r.taxDue) },
            { header: 'Withheld', render: (r) => peso(r.taxWithheld) },
            { header: 'Over/(Under)', render: (r) => <span className={r.taxAdjustment < 0 ? 'text-emerald-600' : r.taxAdjustment > 0 ? 'text-rose-600' : ''}>{peso(r.taxAdjustment)}</span> },
        ],
    },
    'bir-alphalist': {
        totals: (t) => [
            ['Employees', t.employees, Users, 'slate'],
            ['MWE', t.mwe, Users, 'emerald'],
            ['Terminated', t.terminated, Users, 'amber'],
            ['Tax Withheld', peso(t.taxWithheld), Landmark, 'violet'],
        ],
        columns: [
            { header: 'Employee', render: (r) => <span className="font-medium text-slate-800">{r.fullName}</span> },
            { header: 'TIN', render: (r) => <span className="font-mono text-xs">{r.tin || <em className="text-rose-500">missing</em>}</span> },
            { header: 'Schedule', render: (r) => (r.terminated ? '7.1' : r.isMWE ? '7.3' : r.isTaxExempt ? '7.4' : '7.2') },
            { header: 'Gross', render: (r) => peso(r.grossCompensation) },
            { header: 'Non-Taxable', render: (r) => peso(r.nonTaxableCompensation) },
            { header: 'Taxable', render: (r) => peso(r.taxableCompensation) },
            { header: 'Tax Withheld', render: (r) => peso(r.taxWithheld) },
        ],
    },
};

const FORMAT_LABEL = {
    txt: 'Electronic file (.txt)', dat: 'Electronic file (.dat)',
    csv: 'CSV', 'csv-labelled': 'CSV (with header)', pdf: 'PDF',
};

function GovernmentForms() {
    const { forms, isLoading: catLoading } = useGovFormCatalogue();
    const [formKey, setFormKey] = useState('sss-r3');
    const now = moment();
    const [year, setYear] = useState(now.year());
    const [month, setMonth] = useState(now.month() + 1);
    const [busyFmt, setBusyFmt] = useState(null);

    const form = forms.find((f) => f.key === formKey) || null;
    const isAnnual = form?.source === 'annual';

    const previewParams = useMemo(() => ({
        form: formKey,
        year,
        month: isAnnual ? undefined : month,
        period: form?.source,
    }), [formKey, year, month, isAnnual, form?.source]);

    const { data, isLoading, error } = useGovFormPreview(previewParams);
    const view = VIEWS[formKey] || VIEWS['sss-r3'];

    const yearOpts = useMemo(() => {
        const base = now.year();
        return [base - 2, base - 1, base, base + 1].map((y) => ({ label: String(y), value: y }));
    }, [now]);
    const monthOpts = moment.months().map((m, i) => ({ label: m, value: i + 1 }));

    const profileIncomplete = data && !data.employerProfileComplete;

    const runDownload = async (format) => {
        setBusyFmt(format);
        await downloadGovForm({
            form: formKey, year,
            ...(isAnnual ? {} : { month }),
            format,
        });
        setBusyFmt(null);
    };

    if (!can(VIEW)) return <NotFound />;

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="border-b border-slate-100 pb-4">
                <CustomLabel
                    variant="h2"
                    addedClass="font-bold text-slate-700!"
                    descriptionClass="text-xs"
                    description="Statutory filing artifacts built from posted payroll. Always validate against each agency's own data-entry / validation tool before submitting."
                    children="Government Forms"
                />
            </div>

            {/* Form picker */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {catLoading ? [0, 1, 2, 3, 4].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />)
                    : forms.map((f) => (
                        <button
                            key={f.key}
                            type="button"
                            onClick={() => setFormKey(f.key)}
                            className={`rounded-xl border p-3 text-left transition-colors ${
                                formKey === f.key ? 'border-slate-700 bg-slate-50 ring-1 ring-slate-700' : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                        >
                            <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${AGENCY_TONE[f.agency] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                {f.agency}
                            </span>
                            <p className="mt-2 text-xs font-semibold leading-tight text-slate-800">{f.title.replace(/\s*\([^)]*\)\s*$/, '')}</p>
                            <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">{f.source === 'annual' ? 'Annual' : 'Monthly'}</p>
                        </button>
                    ))}
            </div>

            {/* Period + download bar */}
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <div className="w-40">
                    <CustomDropdown label="Year" options={yearOpts} value={year} renderProps="label" returnProps="value" onChange={setYear} className="w-full items-start!" />
                </div>
                {!isAnnual && (
                    <div className="w-44">
                        <CustomDropdown label="Month" options={monthOpts} value={month} renderProps="label" returnProps="value" onChange={setMonth} className="w-full items-start!" />
                    </div>
                )}
                <div className="ml-auto flex flex-wrap gap-2">
                    {can('government-forms:generate') && (form?.formats || []).map((fmt) => (
                        <CustomButton
                            key={fmt}
                            children={FORMAT_LABEL[fmt] || fmt}
                            icon={busyFmt === fmt ? Loader2 : (fmt === 'pdf' ? FileText : fmt.startsWith('csv') ? Download : FileDown)}
                            iconPosition="left"
                            disabled={!!busyFmt || !data || !data.rows?.length || profileIncomplete}
                            onClick={() => runDownload(fmt)}
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium shadow-xs transition-colors disabled:opacity-40 ${
                                fmt === form.defaultFormat ? 'bg-slate-700 text-white hover:bg-slate-600' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                            } ${busyFmt === fmt ? 'animate-pulse' : ''}`}
                        />
                    ))}
                </div>
            </div>

            {/* Persistent caveat */}
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <p>
                    File formats follow the published agency specs but are not officially certified.
                    Run every export through the agency's validation module (SSS portal, PhilHealth EPRS,
                    Virtual Pag-IBIG, BIR Alphalist Data Entry) before filing. Statutory rates come from
                    your <Link to="/dashboard/payroll/statutory-tables" className="font-semibold underline">Statutory Tables</Link> — confirm they match the filing year.
                </p>
            </div>

            {profileIncomplete && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                    <p className="flex items-center gap-2 font-semibold"><Building2 size={16} /> Employer profile is incomplete — downloads are disabled.</p>
                    <p className="mt-1 text-xs">
                        Missing: {(data.employerProfileMissing || []).join(', ')}.{' '}
                        <Link to="/dashboard/payroll/employer-profile" className="font-semibold underline">Complete the Employer Profile</Link>.
                    </p>
                </div>
            )}

            {error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    <ShieldAlert size={16} /> {error}
                </div>
            )}

            {isLoading ? (
                <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
            ) : data ? (
                <div className="space-y-4">
                    <p className="text-xs text-slate-400">
                        {isAnnual ? `Calendar year ${data.period.year}` : `${moment(data.period.from).format('MMMM YYYY')} · ${data.period.from} to ${data.period.to}`}
                        {' · '}{data.rows.length} employee{data.rows.length === 1 ? '' : 's'}
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {view.totals(data.totals || {}).map(([label, value, icon, tone]) => (
                            <StatCard key={label} label={label} value={value} icon={icon} tone={tone} />
                        ))}
                    </div>

                    {(data.warnings || []).length > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                            <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                                <AlertTriangle size={15} /> {data.warnings.length} validation warning{data.warnings.length === 1 ? '' : 's'}
                            </p>
                            <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto pl-6 text-xs text-amber-800">
                                {data.warnings.map((w, i) => (
                                    <li key={i} className="list-disc">
                                        <span className="font-medium">{w.name}</span> — {w.issue}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {!data.warnings?.length && data.rows.length > 0 && (
                        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                            <CheckCircle2 size={16} /> No validation issues found.
                        </div>
                    )}

                    <CustomDataTable
                        data={data.rows}
                        columns={view.columns}
                        isLoading={false}
                        searchPlaceholder="Search employees..."
                    />
                </div>
            ) : (
                <p className="py-12 text-center text-sm text-slate-400">Pick a form and period to preview.</p>
            )}
        </div>
    );
}

export default GovernmentForms;
