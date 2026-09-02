import { useMemo, useState } from 'react';
import { Save, ShieldCheck } from 'lucide-react';
import CustomModal from '../../components/CustomModal';
import CustomInput from '../../components/CustomInput';
import CustomDropdown from '../../components/CustomDropdown';
import CustomDatePicker from '../../components/CustomDatePicker';
import CustomButton from '../../components/CustomButton';
import CustomLabel from '../../components/CustomLabel';
import { usePositions } from '../../hooks/usePosition';
import { useRoles } from '../../hooks/useRoles';
import { EMPLOYMENT_TYPES } from '../../utils/constants';
import { RATE_TYPES } from '../Payroll/payrollOptions';
import { handleNumberInput } from '../../utils/utils';

/**
 * Compact editor for an employee's core HR record: identity, job profile,
 * pay profile, and role assignments. Mirrors the fields the backend
 * `PATCH /employee/:uuid` endpoint accepts.
 */
const buildInitialState = (employee) => ({
    first_name: employee?.first_name || '',
    middle_name: employee?.middle_name || '',
    last_name: employee?.last_name || '',
    position_id: employee?.position?.id || '',
    employment_type: employee?.employment_type || '',
    date_hired: employee?.date_hired || '',
    pay_rate: employee?.compensation?.pay_rate ? String(employee.compensation.pay_rate) : '',
    rate_type: employee?.compensation?.rate_type || 'monthly',
    effective_date: new Date().toISOString().substring(0, 10),
    role_ids: Array.isArray(employee?.roles) ? employee.roles.map((r) => r.id) : [],
});

const EditEmployeeModal = ({ isOpen, employee, onClose, onSubmit, isSaving = false }) => {
    const { positionList } = usePositions();
    const { roles, isLoading: rolesLoading, error: rolesError } = useRoles();

    // The parent keys this component by employee uuid, so a fresh mount (and this
    // initializer) runs for every employee opened — no re-seeding effect needed.
    const [form, setForm] = useState(() => buildInitialState(employee));

    const set = (fields) => setForm((prev) => ({ ...prev, ...fields }));

    const originalPayRate = employee?.compensation?.pay_rate ? String(employee.compensation.pay_rate) : '';
    const originalRateType = employee?.compensation?.rate_type || 'monthly';
    const payChanged = form.pay_rate !== originalPayRate || form.rate_type !== originalRateType;

    const toggleRole = (roleId) => {
        set({
            role_ids: form.role_ids.includes(roleId)
                ? form.role_ids.filter((id) => id !== roleId)
                : [...form.role_ids, roleId],
        });
    };

    const canSave = useMemo(
        () => form.first_name.trim() && form.last_name.trim() && !isSaving,
        [form.first_name, form.last_name, isSaving],
    );

    const handleSave = () => {
        if (!canSave) return;

        const payload = {
            first_name: form.first_name.trim(),
            middle_name: form.middle_name.trim(),
            last_name: form.last_name.trim(),
            employment_type: form.employment_type || null,
            date_hired: form.date_hired || null,
            role_ids: form.role_ids,
        };
        if (form.position_id) payload.position_id = form.position_id;

        // Only supersede the pay profile when the rate actually changed — otherwise
        // every save would stamp a fresh compensation row.
        if (payChanged && form.pay_rate !== '') {
            payload.pay_rate = form.pay_rate;
            payload.rate_type = form.rate_type;
            payload.effective_date = form.effective_date;
        }

        onSubmit(payload);
    };

    return (
        <CustomModal
            isOpen={isOpen}
            onClose={onClose}
            title="Edit Employee Record"
            hasRequiredFields
            size="lg"
            showCloseButton
            footer={
                <CustomButton
                    children={isSaving ? 'Saving...' : 'Save Changes'}
                    onClick={handleSave}
                    icon={Save}
                    iconPosition="right"
                    type="button"
                    isLoading={isSaving}
                    disabled={!canSave}
                    className="flex items-center gap-2 hover:cursor-pointer px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors shadow-xs disabled:opacity-50"
                />
            }
        >
            <div className="p-4 space-y-6 text-left max-h-[65vh] overflow-y-auto scrollbar-y-visible">
                {/* Identity */}
                <section className="space-y-4">
                    <CustomLabel variant="h3" children="Identity" addedClass="font-bold text-slate-500!" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <CustomInput
                            label="First Name"
                            labelPosition="left"
                            isRequired
                            maxLength={50}
                            value={form.first_name}
                            onChange={(e) => set({ first_name: e.target.value })}
                        />
                        <CustomInput
                            label="Middle Name"
                            labelPosition="left"
                            maxLength={50}
                            placeholder="Optional"
                            value={form.middle_name}
                            onChange={(e) => set({ middle_name: e.target.value })}
                        />
                        <CustomInput
                            label="Last Name"
                            labelPosition="left"
                            isRequired
                            maxLength={50}
                            value={form.last_name}
                            onChange={(e) => set({ last_name: e.target.value })}
                        />
                    </div>
                    <p className="text-xs text-slate-400">
                        Email / login address is managed from the employee's credentials and cannot be changed here.
                    </p>
                </section>

                {/* Job profile */}
                <section className="space-y-4 border-t border-slate-100 pt-5">
                    <CustomLabel variant="h3" children="Job Profile" addedClass="font-bold text-slate-500!" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <CustomDropdown
                            className="items-start! w-full"
                            label="Position"
                            options={positionList}
                            value={form.position_id}
                            onChange={(val) => set({ position_id: val })}
                            renderProps="name"
                            returnProps="id"
                            placeholder="Select position.."
                        />
                        <CustomDropdown
                            className="items-start! w-full"
                            label="Employment Type"
                            options={EMPLOYMENT_TYPES}
                            value={form.employment_type}
                            onChange={(val) => set({ employment_type: val })}
                            renderProps="label"
                            returnProps="value"
                            placeholder="Select employment type"
                        />
                        <CustomDatePicker
                            className="text-left!"
                            label="Date Hired"
                            value={form.date_hired}
                            onChange={(date) => set({ date_hired: date })}
                        />
                    </div>
                </section>

                {/* Pay profile */}
                <section className="space-y-4 border-t border-slate-100 pt-5">
                    <CustomLabel variant="h3" children="Pay Profile" addedClass="font-bold text-slate-500!" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <CustomInput
                            label="Base Pay Rate"
                            labelPosition="left"
                            placeholder="Ex. 25000.00"
                            value={form.pay_rate}
                            onChange={(e) => set({ pay_rate: handleNumberInput(e.target.value) })}
                        />
                        <CustomDropdown
                            className="items-start! w-full"
                            label="Rate Type"
                            options={RATE_TYPES}
                            value={form.rate_type}
                            onChange={(val) => set({ rate_type: val })}
                            renderProps="label"
                            returnProps="value"
                            placeholder="Select rate type"
                        />
                        {payChanged && (
                            <CustomDatePicker
                                className="text-left!"
                                label="Rate Effective Date"
                                value={form.effective_date}
                                onChange={(date) => set({ effective_date: date })}
                            />
                        )}
                    </div>
                    {payChanged ? (
                        <p className="text-xs text-amber-600">
                            A new compensation record will be activated from the effective date. The previous rate is kept for history.
                        </p>
                    ) : (
                        <p className="text-xs text-slate-400">Leave untouched to keep the current pay profile.</p>
                    )}
                </section>

                {/* Roles */}
                <section className="space-y-3 border-t border-slate-100 pt-5">
                    <CustomLabel
                        variant="h3"
                        children="Roles & Access"
                        addedClass="font-bold text-slate-500!"
                    />
                    {rolesError ? (
                        <p className="text-sm text-rose-500">
                            You don't have access to manage roles. Ask an administrator with roles &amp; permissions
                            access to adjust this employee's roles.
                        </p>
                    ) : rolesLoading ? (
                        <p className="text-sm text-slate-400">Loading roles…</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {roles.map((role) => {
                                const checked = form.role_ids.includes(role.id);
                                return (
                                    <label
                                        key={role.id}
                                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                            checked
                                                ? 'border-indigo-300 bg-indigo-50/60'
                                                : 'border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="mt-0.5 w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                                            checked={checked}
                                            onChange={() => toggleRole(role.id)}
                                        />
                                        <span className="min-w-0">
                                            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                                                {role.name}
                                                {role.is_default && (
                                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600">
                                                        <ShieldCheck size={11} /> default
                                                    </span>
                                                )}
                                            </span>
                                            {role.description && (
                                                <span className="block text-xs text-slate-400 truncate">
                                                    {role.description}
                                                </span>
                                            )}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                    {form.role_ids.length === 0 && !rolesLoading && !rolesError && (
                        <p className="text-xs text-rose-500">
                            This employee will have no role and may lose self-service portal access.
                        </p>
                    )}
                </section>
            </div>
        </CustomModal>
    );
};

export default EditEmployeeModal;
