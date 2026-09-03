import { useEffect, useState } from 'react';
import { Save, ShieldAlert, Building2, MapPin, Landmark, PenLine, Phone, CheckCircle2, AlertTriangle } from 'lucide-react';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import CustomDropdown from '../../components/CustomDropdown';
import CustomLabel from '../../components/CustomLabel';
import NotFound from '../../components/NotFound';
import { can } from '../../utils/permissionCheck';
import { useEmployerProfile } from '../../hooks/usePayroll';

const VIEW = 'payroll-and-compensation:view';

const FIELDS = [
    'legal_name', 'trade_name', 'tin', 'tin_branch', 'rdo_code', 'business_category',
    'address_line1', 'address_line2', 'city', 'province', 'zip_code',
    'sss_employer_no', 'philhealth_pen', 'pagibig_employer_id',
    'signatory_name', 'signatory_position', 'signatory_tin',
    'contact_person', 'contact_email', 'contact_phone',
];

const s = (v) => (v === null || v === undefined ? '' : String(v));
const toForm = (p) => Object.fromEntries(FIELDS.map((k) => [k, s(p?.[k])]));

const MISSING_LABELS = {
    legal_name: 'Registered legal name',
    tin: 'TIN (9 digits)',
    rdo_code: 'RDO code',
    address: 'Registered address (line 1 + city)',
    sss_employer_no: 'SSS Employer Number',
    philhealth_pen: 'PhilHealth Employer Number (PEN)',
    pagibig_employer_id: 'Pag-IBIG Employer ID',
    signatory: 'Authorized signatory name + position',
};

const CATEGORY_OPTS = [
    { label: 'Private', value: 'private' },
    { label: 'Government', value: 'government' },
];

function Section({ icon: Icon, title, children }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-700">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Icon size={15} /></span>
                {title}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
        </div>
    );
}

function EmployerProfile() {
    const { profile, completeness, isLoading, error, save, isSaving } = useEmployerProfile();
    const [form, setForm] = useState(toForm(null));
    const [dirty, setDirty] = useState(false);

    useEffect(() => { if (profile) { setForm(toForm(profile)); setDirty(false); } }, [profile]);

    const set = (k, v) => { setForm((p) => ({ ...p, [k]: v })); setDirty(true); };

    const localError = () => {
        if (form.tin && form.tin.replace(/\D/g, '').length !== 9) return 'TIN must be 9 digits.';
        if (form.signatory_tin && ![9, 12].includes(form.signatory_tin.replace(/\D/g, '').length)) return 'Signatory TIN must be 9 or 12 digits.';
        if (form.contact_email && !/^\S+@\S+\.\S+$/.test(form.contact_email)) return 'Contact email is invalid.';
        return null;
    };
    const vErr = localError();

    const submit = async () => {
        if (vErr) return;
        try {
            await save(form);
            setDirty(false);
        } catch { /* toast handled in hook */ }
    };

    if (!can(VIEW)) return <NotFound />;

    const readOnly = !can('payroll-and-compensation:edit');

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="border-b border-slate-100 pb-4">
                <CustomLabel
                    variant="h2"
                    addedClass="font-bold text-slate-700!"
                    descriptionClass="text-xs"
                    description="Registered-employer identity used on every BIR / SSS / PhilHealth / Pag-IBIG filing artifact."
                    children="Employer Profile"
                />
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    <ShieldAlert size={16} /> {error}
                </div>
            )}

            {!isLoading && (
                completeness.isComplete ? (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                        <CheckCircle2 size={16} /> Profile is complete — government forms can be generated.
                    </div>
                ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} /> Incomplete — the following are required before forms can be generated:</p>
                        <ul className="mt-1 list-disc pl-8 text-xs">
                            {completeness.missing.map((m) => <li key={m}>{MISSING_LABELS[m] || m}</li>)}
                        </ul>
                    </div>
                )
            )}

            {isLoading ? (
                <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
            ) : (
                <>
                    <Section icon={Building2} title="Identity">
                        <CustomInput label="Registered legal name" isRequired value={s(form.legal_name)} disabled={readOnly} onChange={(e) => set('legal_name', e.target.value)} />
                        <CustomInput label="Trade name / DBA" value={s(form.trade_name)} disabled={readOnly} onChange={(e) => set('trade_name', e.target.value)} />
                        <CustomInput label="TIN (9 digits, no dashes)" isRequired value={s(form.tin)} disabled={readOnly} inputClassName="font-mono" placeholder="123456789" onChange={(e) => set('tin', e.target.value.replace(/\D/g, '').slice(0, 9))} />
                        <CustomInput label="TIN branch code" value={s(form.tin_branch)} disabled={readOnly} inputClassName="font-mono" placeholder="0000" onChange={(e) => set('tin_branch', e.target.value.replace(/\D/g, '').slice(0, 5))} />
                        <CustomInput label="RDO code" isRequired value={s(form.rdo_code)} disabled={readOnly} inputClassName="font-mono" placeholder="050" onChange={(e) => set('rdo_code', e.target.value.slice(0, 6))} />
                        <CustomDropdown label="Business category" options={CATEGORY_OPTS} value={form.business_category || 'private'} renderProps="label" returnProps="value" disabled={readOnly} onChange={(v) => set('business_category', v)} className="w-full items-start!" />
                    </Section>

                    <Section icon={MapPin} title="Registered Address">
                        <CustomInput label="Address line 1" isRequired value={s(form.address_line1)} disabled={readOnly} onChange={(e) => set('address_line1', e.target.value)} />
                        <CustomInput label="Address line 2" value={s(form.address_line2)} disabled={readOnly} onChange={(e) => set('address_line2', e.target.value)} />
                        <CustomInput label="City / Municipality" isRequired value={s(form.city)} disabled={readOnly} onChange={(e) => set('city', e.target.value)} />
                        <CustomInput label="Province" value={s(form.province)} disabled={readOnly} onChange={(e) => set('province', e.target.value)} />
                        <CustomInput label="ZIP code" value={s(form.zip_code)} disabled={readOnly} inputClassName="font-mono" onChange={(e) => set('zip_code', e.target.value.slice(0, 10))} />
                    </Section>

                    <Section icon={Landmark} title="Agency Employer Numbers">
                        <CustomInput label="SSS Employer Number" isRequired value={s(form.sss_employer_no)} disabled={readOnly} inputClassName="font-mono" placeholder="03-9999999-9" onChange={(e) => set('sss_employer_no', e.target.value.slice(0, 20))} />
                        <CustomInput label="PhilHealth Employer Number (PEN)" isRequired value={s(form.philhealth_pen)} disabled={readOnly} inputClassName="font-mono" onChange={(e) => set('philhealth_pen', e.target.value.slice(0, 20))} />
                        <CustomInput label="Pag-IBIG Employer ID" isRequired value={s(form.pagibig_employer_id)} disabled={readOnly} inputClassName="font-mono" onChange={(e) => set('pagibig_employer_id', e.target.value.slice(0, 20))} />
                    </Section>

                    <Section icon={PenLine} title="Authorized Signatory (BIR 2316 / 1604-C)">
                        <CustomInput label="Signatory name" isRequired value={s(form.signatory_name)} disabled={readOnly} onChange={(e) => set('signatory_name', e.target.value)} />
                        <CustomInput label="Position / designation" isRequired value={s(form.signatory_position)} disabled={readOnly} onChange={(e) => set('signatory_position', e.target.value)} />
                        <CustomInput label="Signatory TIN" value={s(form.signatory_tin)} disabled={readOnly} inputClassName="font-mono" onChange={(e) => set('signatory_tin', e.target.value.replace(/\D/g, '').slice(0, 12))} />
                    </Section>

                    <Section icon={Phone} title="Contact">
                        <CustomInput label="Contact person" value={s(form.contact_person)} disabled={readOnly} onChange={(e) => set('contact_person', e.target.value)} />
                        <CustomInput label="Contact email" value={s(form.contact_email)} disabled={readOnly} type="email" onChange={(e) => set('contact_email', e.target.value)} />
                        <CustomInput label="Contact phone" value={s(form.contact_phone)} disabled={readOnly} onChange={(e) => set('contact_phone', e.target.value)} />
                    </Section>

                    {!readOnly && (
                        <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
                            <span className="text-xs text-rose-500">{vErr || (dirty ? 'Unsaved changes' : '')}</span>
                            <CustomButton
                                children="Save Profile"
                                onClick={submit}
                                icon={Save}
                                iconPosition="left"
                                isLoading={isSaving}
                                disabled={isSaving || !!vErr || !dirty}
                                className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white shadow-xs transition-colors hover:cursor-pointer hover:bg-slate-600 disabled:opacity-50"
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default EmployerProfile;
