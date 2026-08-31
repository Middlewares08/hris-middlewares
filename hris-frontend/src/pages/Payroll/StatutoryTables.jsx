import { useState, useRef } from 'react';
import { PlusIcon, Save, ShieldAlert, Trash, Landmark, X } from 'lucide-react';
import { CustomDataTable } from '../../components/CustomDataTable';
import CustomModal from '../../components/CustomModal';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import CustomDropdown from '../../components/CustomDropdown';
import CustomLabel from '../../components/CustomLabel';
import CustomForm from '../../components/CustomForm';
import NotFound from '../../components/NotFound';
import { can } from '../../utils/permissionCheck';
import { useStatutoryTables } from '../../hooks/usePayroll';
import {
    STATUTORY_TYPES, STATUTORY_FREQUENCIES, COMPUTATION_TYPES, COMPUTATION_HELP, fmtDate, peso,
} from './payrollOptions';
import { statutoryTableValidationSchema } from '../../validation/statutory-table-validation';
import Pill from './Pill';
import CustomSelection from '../../components/CustomSelection';

const VIEW = 'statutory-and-compliance:view';

// --- string / number / percent helpers (CustomInput always needs a string) ---
const s = (v) => (v === null || v === undefined ? '' : String(v));
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
const decToPct = (v) => (v === null || v === undefined || v === '' ? '' : String(Math.round(Number(v) * 1e6) / 1e4));
const pctToDec = (v) => (v === '' || v === null || v === undefined ? null : Math.round((Number(v) / 100) * 1e6) / 1e6);
const pct = (v) => (v === null || v === undefined ? '—' : `${Math.round(Number(v) * 1e4) / 1e2}%`);

const BLANK = {
    type: 'sss', label: '', effective_from: '', effective_to: '', frequency: 'monthly',
    computation_type: 'flat_percentage', is_active: true,
    employee_rate_pct: '', employer_rate_pct: '',
    salary_floor: '', salary_ceiling: '', salary_rounding: '', ec_amount: '',
    brackets: [],
};

const BLANK_BRACKET = {
    lower_bound: '', upper_bound: '',
    employee_amount: '', employer_amount: '', ec_amount: '',
    employee_rate_pct: '', employer_rate_pct: '',
    base_tax: '', tax_rate_pct: '',
};

const toForm = (row) => ({
    ...BLANK,
    ...row,
    effective_from: s(row.effective_from).slice(0, 10),
    effective_to: s(row.effective_to).slice(0, 10),
    employee_rate_pct: decToPct(row.employee_rate),
    employer_rate_pct: decToPct(row.employer_rate),
    salary_floor: s(row.salary_floor),
    salary_ceiling: s(row.salary_ceiling),
    salary_rounding: s(row.salary_rounding),
    ec_amount: s(row.ec_amount),
    brackets: (row.brackets || []).map((b) => ({
        lower_bound: s(b.lower_bound),
        upper_bound: s(b.upper_bound),
        employee_amount: s(b.employee_amount),
        employer_amount: s(b.employer_amount),
        ec_amount: s(b.ec_amount),
        employee_rate_pct: decToPct(b.employee_rate),
        employer_rate_pct: decToPct(b.employer_rate),
        base_tax: s(b.base_tax),
        tax_rate_pct: decToPct(b.tax_rate),
    })),
});

// column config per computation type for the bracket editor / viewer
const BRACKET_COLS = {
    fixed_bracket: [
        ['employee_amount', 'EE ₱'], ['employer_amount', 'ER ₱'], ['ec_amount', 'EC ₱'],
    ],
    tiered_percentage: [
        ['employee_rate_pct', 'EE %'], ['employer_rate_pct', 'ER %'],
    ],
    tax_bracket: [
        ['base_tax', 'Base tax ₱'], ['tax_rate_pct', 'Rate %'],
    ],
};

function StatutoryTables() {
    const { items, isLoading, error, create, update, remove, isMutating } = useStatutoryTables();
    const [form, setForm] = useState(null);
    const [toDelete, setToDelete] = useState(null);
    const formikRef = useRef(null);
    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const method = form?.computation_type || 'flat_percentage';
    const usesBrackets = method !== 'flat_percentage';
    const usesRates = method === 'flat_percentage';
    const usesCeiling = method === 'flat_percentage' || method === 'tiered_percentage';
    const showEc = form?.type === 'sss';
    const bracketCols = BRACKET_COLS[method] || [];

    const addBracket = () => set('brackets', [...form.brackets, { ...BLANK_BRACKET }]);
    const removeBracket = (i) => set('brackets', form.brackets.filter((_, idx) => idx !== i));
    const setBracket = (i, k, v) =>
        set('brackets', form.brackets.map((b, idx) => (idx === i ? { ...b, [k]: v } : b)));

    const submit = async () => {
        const payload = {
            type: form.type,
            label: form.label.trim(),
            effective_from: form.effective_from,
            effective_to: form.effective_to || null,
            frequency: form.frequency,
            computation_type: method,
            is_active: !!form.is_active,
            employee_rate: usesRates ? pctToDec(form.employee_rate_pct) : null,
            employer_rate: usesRates ? pctToDec(form.employer_rate_pct) : null,
            salary_floor: method === 'flat_percentage' ? num(form.salary_floor) : null,
            salary_ceiling: usesCeiling ? num(form.salary_ceiling) : null,
            salary_rounding: method === 'flat_percentage' ? num(form.salary_rounding) : null,
            ec_amount: showEc ? num(form.ec_amount) : null,
            brackets: usesBrackets
                ? form.brackets.map((b) => ({
                    lower_bound: Number(b.lower_bound) || 0,
                    upper_bound: b.upper_bound === '' ? null : Number(b.upper_bound),
                    employee_amount: method === 'fixed_bracket' ? num(b.employee_amount) : null,
                    employer_amount: method === 'fixed_bracket' ? num(b.employer_amount) : null,
                    ec_amount: method === 'fixed_bracket' ? num(b.ec_amount) : null,
                    employee_rate: method === 'tiered_percentage' ? pctToDec(b.employee_rate_pct) : null,
                    employer_rate: method === 'tiered_percentage' ? pctToDec(b.employer_rate_pct) : null,
                    base_tax: method === 'tax_bracket' ? num(b.base_tax) : null,
                    tax_rate: method === 'tax_bracket' ? pctToDec(b.tax_rate_pct) : null,
                }))
                : [],
        };

        try {
            if (form.uuid) await update({ uuid: form.uuid, payload });
            else await create(payload);
            setForm(null);
        } catch { /* handled */ }
    };

    const columns = [
        {
            header: 'Table',
            render: (r) => (
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-600">
                        <Landmark size={16} />
                    </div>
                    <div>
                        <div className="font-semibold text-slate-900">{r.label}</div>
                        <div className="text-xs uppercase text-slate-400">{r.type}</div>
                    </div>
                </div>
            ),
        },
        { header: 'Method', render: (r) => <span className="text-sm capitalize text-slate-600">{String(r.computation_type || '').replace(/_/g, ' ')}</span> },
        { header: 'Effective', render: (r) => `${fmtDate(r.effective_from)} – ${r.effective_to ? fmtDate(r.effective_to) : 'open'}` },
        { header: 'Brackets', render: (r) => (r.brackets?.length ? r.brackets.length : '—') },
        { header: 'Active', render: (r) => (r.is_active ? <Pill value="applied" /> : <Pill value="cancelled" />) },
    ];

    const drawer = (row, close) => {
        const cols = BRACKET_COLS[row.computation_type] || [];
        return (
            <div className="mt-4 space-y-4 text-left">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-lg font-bold text-slate-900">{row.label}</p>
                    <p className="text-xs uppercase text-slate-500">
                        {row.type} · {String(row.computation_type || '').replace(/_/g, ' ')} · {fmtDate(row.effective_from)} → {row.effective_to ? fmtDate(row.effective_to) : 'open'}
                    </p>
                </div>

                <dl className="grid grid-cols-2 gap-2 text-sm">
                    {row.computation_type === 'flat_percentage' && (
                        <>
                            <div><dt className="text-xs text-slate-400">Employee rate</dt><dd>{pct(row.employee_rate)}</dd></div>
                            <div><dt className="text-xs text-slate-400">Employer rate</dt><dd>{pct(row.employer_rate)}</dd></div>
                        </>
                    )}
                    {row.salary_floor != null && <div><dt className="text-xs text-slate-400">Salary floor</dt><dd>{peso(row.salary_floor)}</dd></div>}
                    {row.salary_ceiling != null && <div><dt className="text-xs text-slate-400">Salary ceiling</dt><dd>{peso(row.salary_ceiling)}</dd></div>}
                    {row.salary_rounding != null && <div><dt className="text-xs text-slate-400">Round salary to</dt><dd>{peso(row.salary_rounding)}</dd></div>}
                    {row.ec_amount != null && <div><dt className="text-xs text-slate-400">Employer EC</dt><dd>{peso(row.ec_amount)}</dd></div>}
                </dl>

                {cols.length > 0 && row.brackets?.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-slate-100">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50 text-slate-500">
                                <tr>
                                    <th className="p-2 text-left">From</th>
                                    <th className="p-2 text-left">To</th>
                                    {cols.map(([k, l]) => <th key={k} className="p-2 text-right">{l}</th>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {row.brackets.map((b) => (
                                    <tr key={b.uuid || b.id}>
                                        <td className="p-2">{peso(b.lower_bound)}</td>
                                        <td className="p-2">{b.upper_bound == null ? 'and up' : peso(b.upper_bound)}</td>
                                        {cols.map(([k]) => (
                                            <td key={k} className="p-2 text-right">
                                                {k.endsWith('_pct')
                                                    ? pct(k === 'employee_rate_pct' ? b.employee_rate : k === 'employer_rate_pct' ? b.employer_rate : b.tax_rate)
                                                    : peso(b[k])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="flex gap-2">
                    {can('statutory-and-compliance:edit') && (
                        <CustomButton 
                            children='Edit'
                            onClick={() => { close(); setForm(toForm(row)); }}
                            className="flex-1 py-2 border border-slate-200 rounded text-xs bg-white! text-blue-700! hover:bg-blue-50!"
                        />
                    )}
                    {can('statutory-and-compliance:delete') && (
                        <CustomButton 
                            children='Archive'
                            onClick={() => { close(); setToDelete(row); }}
                            className="flex-1 py-2 border border-rose-200 rounded text-xs bg-rose-50! text-rose-600! hover:bg-rose-100!"
                        />
                    )}
                </div>
            </div>
        );
    };

    if (!can(VIEW)) return <NotFound />;

    const cell = 'w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500';

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="border-b border-slate-100 pb-4">
                <CustomLabel 
                    descriptionClass='text-xs'
                    children='Statutory Tables'
                    variant="h2" 
                    addedClass="font-bold text-slate-700!" description="SSS / PhilHealth / Pag-IBIG / withholding-tax rules that drive the payroll engine."
                />
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Verify every rate and bracket against the latest official circular before running live payroll.
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    <ShieldAlert size={16} /> {error}
                </div>
            )}

            <CustomDataTable
                data={items}
                columns={columns}
                isLoading={isLoading}
                searchPlaceholder="Search tables..."
                renderDrawerContent={drawer}
                actionButton={can('statutory-and-compliance:create') && (
                    <CustomButton 
                        children='Add Table'
                        onClick={() => setForm({ ...BLANK })} 
                        icon={PlusIcon} 
                        iconPosition="left"
                        className='flex py-2 items-center gap-2 hover:cursor-pointer px-4 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors shadow-xs'
                    />
                )}
            />

            <CustomModal
                isOpen={!!form}
                onClose={() => setForm(null)}
                title={form?.uuid ? 'Edit Statutory Table' : 'New Statutory Table'}
                size="xl"
                showCloseButton
                hasRequiredFields
                footer={(
                    <div className="flex justify-center border-t border-slate-100 pt-4">
                        <CustomButton
                            children={form?.uuid ? 'Save Changes' : 'Create'}
                            onClick={() => formikRef?.current?.submitForm()}
                            icon={Save}
                            iconPosition="left"
                            isLoading={isMutating}
                            disabled={isMutating}
                            className='flex py-2 items-center gap-2 hover:cursor-pointer px-4 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors shadow-xs'
                        />
                    </div>
                )}
            >
                {form && (
                    <CustomForm
                        formRef={formikRef}
                        initialValues={form}
                        validationSchema={statutoryTableValidationSchema}
                        onSubmit={submit}
                        id="statutory-table-form"
                        content={(errors, touched) => (
                            <div className="max-h-[65vh] space-y-4 px-1 scrollbar-y-visible overflow-y-auto pb-4">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <CustomDropdown label="Type" isRequired options={STATUTORY_TYPES} value={form.type}
                                        renderProps="label" returnProps="value" disabled={!!form.uuid}
                                        onChange={(v) => set('type', v)} className="w-full items-start!"
                                        error={errors.type && touched.type} errorLabel={errors.type} />
                                    <CustomDropdown label="Frequency" options={STATUTORY_FREQUENCIES} value={form.frequency}
                                        renderProps="label" returnProps="value" onChange={(v) => set('frequency', v)} className="w-full items-start!"
                                        error={errors.frequency && touched.frequency} errorLabel={errors.frequency} />
                                </div>

                                <CustomInput label="Label" isRequired value={s(form.label)} placeholder="SSS Contribution Schedule (2025)"
                                    onChange={(e) => set('label', e.target.value)}
                                    error={errors.label && touched.label} errorLabel={errors.label} />

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <CustomInput label="Effective from" isRequired type="date" value={s(form.effective_from)}
                                        onChange={(e) => set('effective_from', e.target.value)}
                                        error={errors.effective_from && touched.effective_from} errorLabel={errors.effective_from} />
                                    <CustomInput label="Effective to" type="date" value={s(form.effective_to)}
                                        onChange={(e) => set('effective_to', e.target.value)}
                                        error={errors.effective_to && touched.effective_to} errorLabel={errors.effective_to} />
                                </div>

                                <div>
                                    <CustomDropdown label="Computation method" isRequired options={COMPUTATION_TYPES} value={method}
                                        renderProps="label" returnProps="value" onChange={(v) => set('computation_type', v)} className="w-full items-start!"
                                        error={errors.computation_type && touched.computation_type} errorLabel={errors.computation_type} />
                                    <p className="mt-1 text-xs text-slate-400 text-left">{COMPUTATION_HELP[method]}</p>
                                </div>

                                {/* scalar knobs */}
                                {(usesRates || usesCeiling || showEc) && (
                                    <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:grid-cols-3">
                                        {usesRates && (
                                            <>
                                                <CustomInput label="Employee rate (%)" type="number" value={s(form.employee_rate_pct)}
                                                    placeholder="2.5" onChange={(e) => set('employee_rate_pct', e.target.value)}
                                                    error={errors.employee_rate_pct && touched.employee_rate_pct} errorLabel={errors.employee_rate_pct} />
                                                <CustomInput label="Employer rate (%)" type="number" value={s(form.employer_rate_pct)}
                                                    placeholder="2.5" onChange={(e) => set('employer_rate_pct', e.target.value)}
                                                    error={errors.employer_rate_pct && touched.employer_rate_pct} errorLabel={errors.employer_rate_pct} />
                                            </>
                                        )}
                                        {method === 'flat_percentage' && (
                                            <CustomInput label="Salary floor (₱)" type="number" value={s(form.salary_floor)}
                                                onChange={(e) => set('salary_floor', e.target.value)} />
                                        )}
                                        {usesCeiling && (
                                            <CustomInput label="Salary ceiling (₱)" type="number" value={s(form.salary_ceiling)}
                                                onChange={(e) => set('salary_ceiling', e.target.value)} />
                                        )}
                                        {method === 'flat_percentage' && (
                                            <CustomInput label="Round salary to (₱)" type="number" value={s(form.salary_rounding)}
                                                placeholder="e.g. 500 for SSS MSC" onChange={(e) => set('salary_rounding', e.target.value)} />
                                        )}
                                        {showEc && (
                                            <CustomInput label="Employer EC (₱)" type="number" value={s(form.ec_amount)}
                                                onChange={(e) => set('ec_amount', e.target.value)} />
                                        )}
                                    </div>
                                )}

                                {/* bracket editor */}
                                {usesBrackets && (
                                    <div className="rounded-xl border border-slate-200">
                                        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                                            <p className="text-sm font-semibold text-slate-700">Salary bands</p>
                                            <button type="button" onClick={addBracket}
                                                className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700">
                                                <PlusIcon size={13} /> Add band
                                            </button>
                                        </div>
                                        {form.brackets.length === 0 ? (
                                            <p className="px-3 py-4 text-center text-xs text-slate-400">No bands yet. Add one to start.</p>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs">
                                                    <thead className="bg-slate-50 text-slate-500">
                                                        <tr>
                                                            <th className="p-2 text-left font-medium">From (₱)</th>
                                                            <th className="p-2 text-left font-medium">To (₱, blank = &amp; up)</th>
                                                            {bracketCols.map(([k, l]) => <th key={k} className="p-2 text-left font-medium">{l}</th>)}
                                                            <th className="w-8" />
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {form.brackets.map((b, i) => (
                                                            <tr key={i}>
                                                                <td className="p-1.5">
                                                                    <input className={cell} type="number" value={b.lower_bound}
                                                                        onChange={(e) => setBracket(i, 'lower_bound', e.target.value)} />
                                                                </td>
                                                                <td className="p-1.5">
                                                                    <input className={cell} type="number" value={b.upper_bound}
                                                                        onChange={(e) => setBracket(i, 'upper_bound', e.target.value)} />
                                                                </td>
                                                                {bracketCols.map(([k]) => (
                                                                    <td key={k} className="p-1.5">
                                                                        <input className={cell} type="number" value={b[k]}
                                                                            onChange={(e) => setBracket(i, k, e.target.value)} />
                                                                    </td>
                                                                ))}
                                                                <td className="p-1.5 text-center">
                                                                    <button type="button" onClick={() => removeBracket(i)}
                                                                        className="text-slate-300 hover:text-rose-500">
                                                                        <X size={14} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                        {typeof errors.brackets === 'string' && touched.brackets && (
                                            <p className="border-t border-slate-100 px-3 py-2 text-xs font-semibold text-red-500">{errors.brackets}</p>
                                        )}
                                    </div>
                                )}

                                <div className='flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-slate-100 bg-slate-50 p-2'>
                                    <CustomSelection
                                        className='text-left w-40'
                                        label="Active"
                                        checked={form.is_active}
                                        onChange={(e) => set('is_active', e.target.checked)}
                                        indicatorPosition='left'
                                    />

                                </div>
                            </div>
                        )}
                    />
                )}
            </CustomModal>

            <CustomModal isOpen={!!toDelete} onClose={() => setToDelete(null)} title="Archive table?" size="md">
                <div className="p-2 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-rose-100 bg-rose-50 text-rose-500">
                        <ShieldAlert size={26} />
                    </div>
                    <p className="mb-6 text-sm text-slate-500">
                        Archive <span className="font-semibold text-slate-800">{toDelete?.label}</span>? The engine will fall back to the next active schedule for {toDelete?.type}.
                    </p>
                    <div className="flex gap-3 border-t border-slate-100 pt-4">
                        <CustomButton onClick={() => setToDelete(null)} className="flex-1 border border-slate-200 bg-white! text-slate-700! hover:bg-slate-100!">Cancel</CustomButton>
                        <CustomButton variant="danger" icon={Trash} iconPosition="left" isLoading={isMutating}
                            onClick={async () => { try { await remove(toDelete.uuid); setToDelete(null); } catch { /* handled */ } }}
                            className="flex-1">Archive</CustomButton>
                    </div>
                </div>
            </CustomModal>
        </div>
    );
}

export default StatutoryTables;
