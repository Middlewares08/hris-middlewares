import { useState } from 'react';
import CustomModal from '../../components/CustomModal';
import CustomButton from '../../components/CustomButton';
import { useEmployees } from '../../hooks/useEmployee';
import { useSeparations } from '../../hooks/useSeparations';

const SEPARATION_TYPES = [
    { value: 'resignation', label: 'Resignation', voluntary: true },
    { value: 'termination', label: 'Termination', voluntary: false },
    { value: 'end_of_contract', label: 'End of Contract', voluntary: false },
    { value: 'retirement', label: 'Retirement', voluntary: true },
    { value: 'redundancy', label: 'Redundancy', voluntary: false },
    { value: 'death', label: 'Death', voluntary: false },
    { value: 'other', label: 'Other', voluntary: false },
];

const todayYmd = () => new Date().toISOString().slice(0, 10);

/**
 * Record a separation. `lockedEmployee` (optional) = { id, name } pre-selects and
 * hides the employee picker — used from the employee detail drawer.
 */
function SeparationFormModal({ isOpen, onClose, lockedEmployee = null, onSaved }) {
    const { create, isMutating } = useSeparations();
    const [employeeSearch, setEmployeeSearch] = useState('');
    const { employees } = useEmployees({ page: 1, limit: 100, search: employeeSearch });

    const [form, setForm] = useState({
        employee_id: lockedEmployee?.id || '',
        separation_date: todayYmd(),
        last_working_day: '',
        separation_type: 'resignation',
        is_voluntary: true,
        reason: '',
        eligible_for_rehire: true,
    });

    const set = (patch) => setForm((f) => ({ ...f, ...patch }));

    const onTypeChange = (value) => {
        const meta = SEPARATION_TYPES.find((t) => t.value === value);
        set({ separation_type: value, is_voluntary: meta ? meta.voluntary : false });
    };

    const submit = async () => {
        if (!form.employee_id || !form.separation_date) return;
        try {
            await create({
                employee_id: Number(form.employee_id),
                separation_date: form.separation_date,
                last_working_day: form.last_working_day || undefined,
                separation_type: form.separation_type,
                is_voluntary: form.is_voluntary,
                reason: form.reason.trim() || undefined,
                eligible_for_rehire: form.eligible_for_rehire,
            });
            onSaved?.();
            onClose();
        } catch { /* toast handled in hook */ }
    };

    return (
        <CustomModal
            isOpen={isOpen}
            onClose={onClose}
            title="Record a separation"
            size="md"
            showCloseButton
            footer={(
                <div className="flex gap-3 border-t border-slate-100 pt-4">
                    <CustomButton onClick={onClose} className="flex-1 border border-slate-200 bg-white! text-slate-700! hover:bg-slate-100!">Cancel</CustomButton>
                    <CustomButton
                        variant="danger"
                        isLoading={isMutating}
                        disabled={!form.employee_id || !form.separation_date}
                        onClick={submit}
                        className="flex-1"
                    >
                        Record & set inactive
                    </CustomButton>
                </div>
            )}
        >
            <div className="space-y-3 px-1 text-sm">
                {lockedEmployee ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs text-slate-400">Employee</p>
                        <p className="font-semibold text-slate-800">{lockedEmployee.name}</p>
                    </div>
                ) : (
                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">Employee</label>
                        <input
                            type="text"
                            value={employeeSearch}
                            onChange={(e) => setEmployeeSearch(e.target.value)}
                            placeholder="Search by name..."
                            className="mb-2 w-full rounded-lg border border-gray-300 p-2 text-sm focus:outline-gray-600"
                        />
                        <select
                            value={form.employee_id}
                            onChange={(e) => set({ employee_id: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:outline-gray-600"
                        >
                            <option value="">Select an employee…</option>
                            {employees.map((e) => (
                                <option key={e.id} value={e.id}>
                                    {`${e.first_name} ${e.last_name}`}{e.employee_id ? ` (${e.employee_id})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">Separation date</label>
                        <input type="date" value={form.separation_date} onChange={(e) => set({ separation_date: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:outline-gray-600" />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">Last working day</label>
                        <input type="date" value={form.last_working_day} onChange={(e) => set({ last_working_day: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:outline-gray-600" />
                    </div>
                </div>

                <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Type</label>
                    <select value={form.separation_type} onChange={(e) => onTypeChange(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:outline-gray-600">
                        {SEPARATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                </div>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                    <input type="checkbox" checked={form.is_voluntary} onChange={(e) => set({ is_voluntary: e.target.checked })} />
                    Voluntary (employee-initiated)
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                    <input type="checkbox" checked={form.eligible_for_rehire} onChange={(e) => set({ eligible_for_rehire: e.target.checked })} />
                    Eligible for rehire
                </label>

                <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Reason (optional)</label>
                    <textarea rows={3} maxLength={500} value={form.reason} onChange={(e) => set({ reason: e.target.value })}
                        placeholder="Context for the separation…"
                        className="w-full resize-none rounded-lg border border-gray-300 p-2 text-sm focus:outline-gray-600" />
                </div>

                <p className="text-xs text-slate-400">Recording this sets the employee to inactive. Removing the record later reinstates them.</p>
            </div>
        </CustomModal>
    );
}

export default SeparationFormModal;
