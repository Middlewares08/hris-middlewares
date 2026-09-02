import { useMemo, useState, useRef } from 'react';
import moment from 'moment';
import { Fingerprint, Save, ShieldAlert, PlusIcon } from 'lucide-react';
import { CustomDataTable } from '../../components/CustomDataTable';
import CustomModal from '../../components/CustomModal';
import CustomButton from '../../components/CustomButton';
import CustomInput from '../../components/CustomInput';
import CustomDropdown from '../../components/CustomDropdown';
import CustomLabel from '../../components/CustomLabel';
import CustomForm from '../../components/CustomForm';
import NotFound from '../../components/NotFound';
import { can } from '../../utils/permissionCheck';
import { useAttendanceLogs } from '../../hooks/useAttendance';
import { useEmployees } from '../../hooks/useEmployee';
import { attendanceLogValidationSchema } from '../../validation/attendance-log-validation';

const VIEW = 'attendance-logs:view';
const LIMIT = 10;

const STATUS_TONE = {
    present: 'bg-emerald-100 text-emerald-700',
    late: 'bg-amber-100 text-amber-700',
    absent: 'bg-rose-100 text-rose-700',
    on_leave: 'bg-indigo-100 text-indigo-700',
    holiday: 'bg-sky-100 text-sky-700',
    half_day: 'bg-orange-100 text-orange-700',
};

const STATUS_OPTIONS = [
    { value: 'present', label: 'Present' },
    { value: 'late', label: 'Late' },
    { value: 'absent', label: 'Absent' },
    { value: 'on_leave', label: 'On leave' },
    { value: 'holiday', label: 'Holiday' },
    { value: 'half_day', label: 'Half day' },
];

const SOURCE_OPTIONS = [
    { value: 'manual', label: 'Manual entry' },
    { value: 'web', label: 'Web clock' },
    { value: 'biometric', label: 'Biometric' },
    { value: 'import', label: 'Import' },
];

const Pill = ({ value }) => (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${STATUS_TONE[value] || 'bg-slate-100 text-slate-600'}`}>
        {String(value || '—').replace(/_/g, ' ')}
    </span>
);

const employeeName = (e) => (e ? `${e.first_name} ${e.last_name}`.trim() : '—');
const fmtDate = (v) => (v ? moment(v).format('MMM D, YYYY') : '—');
const fmtTime = (v) => (v ? moment(v).format('h:mm A') : '—');
const dayName = (v) => (v ? moment(v).format('dddd') : '');

// Combine a YYYY-MM-DD date with an HH:mm time into a naive local ISO-ish string the API accepts.
const joinDateTime = (date, hm) => (date && hm ? `${date}T${hm}:00` : null);

const BLANK_FORM = {
    employee_id: '',
    log_date: moment().format('YYYY-MM-DD'),
    time_in: '',
    time_out: '',
    status: 'present',
    source: 'manual',
    remarks: '',
};

function AttendanceLogs() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({ status: '', employee_id: '', date_from: '', date_to: '' });

    const params = useMemo(() => ({
        page,
        limit: LIMIT,
        search: search || undefined,
        status: filters.status || undefined,
        employee_id: filters.employee_id || undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
    }), [page, search, filters]);

    const { items, totalRecords, isLoading, error, create, update, remove, isMutating } = useAttendanceLogs(params);
    const { employees } = useEmployees({ page: 1, limit: 200, search: '' });

    const employeeOptions = useMemo(
        () => (employees || []).map((e) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` })),
        [employees],
    );

    const [form, setForm] = useState(null);        // create/edit form state
    const [editUuid, setEditUuid] = useState(null); // null => create mode
    const [toDelete, setToDelete] = useState(null);
    const formikRef = useRef(null);

    const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const openCreate = () => {
        setEditUuid(null);
        setForm({ ...BLANK_FORM });
    };

    const openEdit = (row, close) => {
        close?.();
        setEditUuid(row.uuid);
        setForm({
            employee_id: row.employee_id,
            log_date: moment(row.log_date).format('YYYY-MM-DD'),
            time_in: row.time_in ? moment(row.time_in).format('HH:mm') : '',
            time_out: row.time_out ? moment(row.time_out).format('HH:mm') : '',
            status: row.status || 'present',
            source: row.source || 'manual',
            remarks: row.remarks || '',
        });
    };

    const closeForm = () => { setForm(null); setEditUuid(null); };

    const submitForm = async () => {
        const base = {
            time_in: joinDateTime(form.log_date, form.time_in),
            time_out: joinDateTime(form.log_date, form.time_out),
            status: form.status,
            source: form.source,
            remarks: form.remarks.trim() || null,
        };
        try {
            if (editUuid) {
                await update({ uuid: editUuid, payload: base });
            } else {
                await create({ employee_id: form.employee_id, log_date: form.log_date, ...base });
            }
            closeForm();
        } catch { /* toast in hook */ }
    };

    const columns = [
        {
            header: 'Employee',
            render: (r) => (
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-600">
                        <Fingerprint size={16} />
                    </div>
                    <div>
                        <div className="font-semibold text-slate-900">{employeeName(r.employee)}</div>
                        <div className="text-xs text-slate-400">{fmtDate(r.log_date)} · {dayName(r.log_date)}</div>
                    </div>
                </div>
            ),
        },
        { header: 'Time In', render: (r) => <span className="text-slate-700">{fmtTime(r.time_in)}</span> },
        { header: 'Time Out', render: (r) => <span className="text-slate-700">{fmtTime(r.time_out)}</span> },
        { header: 'Hours', render: (r) => <span className="font-medium text-slate-700">{r.worked_hours != null ? `${r.worked_hours}h` : '—'}</span> },
        {
            header: 'Late / UT',
            render: (r) => {
                const late = Number(r.late_minutes) || 0;
                const ut = Number(r.undertime_minutes) || 0;
                if (!late && !ut) return <span className="text-slate-300">—</span>;
                return (
                    <span className="text-xs font-medium">
                        {late > 0 && <span className="text-rose-600">{late}m late</span>}
                        {late > 0 && ut > 0 && <span className="text-slate-300"> · </span>}
                        {ut > 0 && <span className="text-amber-600">{ut}m UT</span>}
                    </span>
                );
            },
        },
        {
            header: 'Status',
            render: (r) => (
                <div className="flex flex-wrap items-center gap-1">
                    <Pill value={r.status} />
                    {r.is_holiday && <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">Holiday</span>}
                    {r.is_rest_day && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">Rest day</span>}
                </div>
            ),
        },
        { header: 'Source', render: (r) => <span className="text-sm capitalize text-slate-500">{String(r.source || '—').replace(/_/g, ' ')}</span> },
    ];

    const fmtSched = (r) => {
        if (!r.scheduled_start || !r.scheduled_end) return r.is_rest_day ? 'Rest day' : '—';
        return `${fmtTime(r.scheduled_start)}–${fmtTime(r.scheduled_end)}${r.scheduled_hours != null ? ` (${r.scheduled_hours}h)` : ''}`;
    };

    const drawer = (row, close) => (
        <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-lg font-bold text-slate-900">{employeeName(row.employee)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                    <Pill value={row.status} />
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {fmtDate(row.log_date)}
                    </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="text-xs text-slate-400">Time in</dt><dd>{fmtTime(row.time_in)}</dd></div>
                    <div><dt className="text-xs text-slate-400">Time out</dt><dd>{fmtTime(row.time_out)}</dd></div>
                    <div><dt className="text-xs text-slate-400">Hours worked</dt><dd>{row.worked_hours != null ? `${row.worked_hours}h` : '—'}</dd></div>
                    <div><dt className="text-xs text-slate-400">Scheduled shift</dt><dd>{fmtSched(row)}</dd></div>
                    <div><dt className="text-xs text-slate-400">Late</dt><dd>{Number(row.late_minutes) ? `${row.late_minutes} min` : '—'}</dd></div>
                    <div><dt className="text-xs text-slate-400">Undertime</dt><dd>{Number(row.undertime_minutes) ? `${row.undertime_minutes} min` : '—'}</dd></div>
                    <div><dt className="text-xs text-slate-400">Source</dt><dd className="capitalize">{String(row.source || '—').replace(/_/g, ' ')}</dd></div>
                    {row.remarks && <div className="col-span-2"><dt className="text-xs text-slate-400">Remarks</dt><dd className="whitespace-pre-wrap">{row.remarks}</dd></div>}
                </dl>
            </div>

            {can('attendance-logs:edit') && (
                <CustomButton 
                    children='Edit record'
                    onClick={() => openEdit(row, close)}
                    variant="primary" className="w-full py-2 text-xs bg-slate-800! text-white! hover:bg-slate-700!"
                />
            )}
            {can('attendance-logs:delete') && (
                <CustomButton 
                    children='Archive'
                    onClick={() => { close(); setToDelete(row); }}
                    variant="primary" 
                    className="w-full  py-2 text-xs  bg-white! text-slate-700! border border-slate-200 hover:bg-slate-100!"
                    />
            )}
        </div>
    );

    if (!can(VIEW)) return <NotFound />;

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="border-b border-slate-100 pb-4">
                <CustomLabel 
                    variant="h2" 
                    descriptionClass='text-xs'
                    children='Attendance Logs'
                    addedClass="font-bold text-slate-700!" 
                    description="Daily time records across the workforce. Filter by employee, status or date, and correct entries where needed."
                />
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
                onSearch={(term) => { setSearch(term); setPage(1); }}
                searchPlaceholder="Search by employee name..."
                isServerSide
                totalRecords={totalRecords}
                currentPage={page}
                recordsPerPage={LIMIT}
                onPageChange={setPage}
                renderDrawerContent={drawer}
                actionButton={
                    can('attendance-logs:create') && (
                        <CustomButton onClick={openCreate} icon={PlusIcon} iconPosition="left"
                            className="flex items-center gap-2 hover:cursor-pointer px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors shadow-xs">
                            Record entry
                        </CustomButton>
                    )
                }
                filterContent={(
                    <>
                        <CustomDropdown
                            label="Status"
                            options={[{ value: '', label: 'All statuses' }, ...STATUS_OPTIONS]}
                            value={filters.status}
                            renderProps="label"
                            returnProps="value"
                            onChange={(v) => { setFilters((f) => ({ ...f, status: v })); setPage(1); }}
                            className="w-full items-start!"
                        />
                        <CustomDropdown
                            label="Employee"
                            options={[{ value: '', label: 'All employees' }, ...employeeOptions]}
                            value={filters.employee_id}
                            renderProps="label"
                            returnProps="value"
                            onChange={(v) => { setFilters((f) => ({ ...f, employee_id: v })); setPage(1); }}
                            className="w-full items-start!"
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <CustomInput label="From" type="date" value={filters.date_from}
                                onChange={(e) => { setFilters((f) => ({ ...f, date_from: e.target.value })); setPage(1); }} />
                            <CustomInput label="To" type="date" value={filters.date_to}
                                onChange={(e) => { setFilters((f) => ({ ...f, date_to: e.target.value })); setPage(1); }} />
                        </div>
                    </>
                )}
            />

            {/* Create / edit modal */}
            <CustomModal
                isOpen={!!form}
                onClose={closeForm}
                title={editUuid ? 'Edit attendance record' : 'Record attendance entry'}
                size="md"
                showCloseButton
                hasRequiredFields
                footer={(
                    <div className="flex justify-center border-t border-slate-100 pt-4">
                        <CustomButton 
                            children={editUuid ? 'Save changes' : 'Save entry'}
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
                        validationSchema={attendanceLogValidationSchema(!!editUuid)}
                        onSubmit={submitForm}
                        id="attendance-log-form"
                        content={(errors, touched) => (
                    <div className="space-y-4 px-1 max-h-[65vh] overflow-y-auto scrollbar-y-visible">
                        {!editUuid && (
                            <CustomDropdown
                                label="Employee"
                                isRequired
                                options={employeeOptions}
                                value={form.employee_id}
                                renderProps="label"
                                returnProps="value"
                                placeholder="Choose an employee..."
                                onChange={(v) => setField('employee_id', v)}
                                className="w-full items-start!"
                                error={errors.employee_id && touched.employee_id}
                                errorLabel={errors.employee_id}
                            />
                        )}
                        <CustomInput label="Date" type="date" isRequired={!editUuid} disabled={!!editUuid}
                            value={form.log_date}
                            onChange={(e) => setField('log_date', e.target.value)}
                            error={errors.log_date && touched.log_date} errorLabel={errors.log_date} />
                        <div className="grid grid-cols-2 gap-3">
                            <CustomInput label="Time in" type="time" value={form.time_in}
                                onChange={(e) => setField('time_in', e.target.value)}
                                error={errors.time_in && touched.time_in} errorLabel={errors.time_in} />
                            <CustomInput label="Time out" type="time" value={form.time_out}
                                onChange={(e) => setField('time_out', e.target.value)}
                                error={errors.time_out && touched.time_out} errorLabel={errors.time_out} />
                        </div>
                        <CustomDropdown
                            label="Status"
                            options={STATUS_OPTIONS}
                            value={form.status}
                            renderProps="label"
                            returnProps="value"
                            onChange={(v) => setField('status', v)}
                            className="w-full items-start!"
                            error={errors.status && touched.status}
                            errorLabel={errors.status}
                        />
                        <CustomDropdown
                            label="Source"
                            options={SOURCE_OPTIONS}
                            value={form.source}
                            renderProps="label"
                            returnProps="value"
                            onChange={(v) => setField('source', v)}
                            className="w-full items-start!"
                            error={errors.source && touched.source}
                            errorLabel={errors.source}
                        />
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-700">Remarks</label>
                            <textarea rows={3} value={form.remarks} maxLength={500}
                                onChange={(e) => setField('remarks', e.target.value)}
                                placeholder="Reason for the correction / note (optional)"
                                className={`w-full resize-none rounded-lg border p-2 text-sm focus:outline-gray-600 ${
                                    errors.remarks && touched.remarks ? 'border-red-400' : 'border-gray-300'
                                }`} />
                            {errors.remarks && touched.remarks && (
                                <p className="mt-1 text-xs font-semibold text-red-500">{errors.remarks}</p>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                            Clock-ins after 9:15 AM are automatically flagged as <span className="font-medium">Late</span> unless
                            you set another status.
                        </p>
                    </div>
                        )}
                    />
                )}
            </CustomModal>

            {/* Archive confirm */}
            <CustomModal isOpen={!!toDelete} onClose={() => setToDelete(null)} title="Archive attendance record?" size="md">
                <div className="p-2 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-rose-100 bg-rose-50 text-rose-500">
                        <ShieldAlert size={26} />
                    </div>
                    <p className="mb-6 text-sm text-slate-500 pb-4">
                        {toDelete && <>Archive <span className="font-semibold text-slate-800">{employeeName(toDelete.employee)}</span>'s record for {fmtDate(toDelete.log_date)}? It will no longer appear in the log.</>}
                    </p>
                    <div className="flex gap-3 border-t border-slate-100 pt-4">
                        <CustomButton 
                            children='Cancel'
                            onClick={() => setToDelete(null)} 
                            className="flex-1 text-center border border-slate-200 bg-white! text-slate-700! hover:bg-slate-100! rounded-lg"
                        />
                        <CustomButton 
                            children='Archive'
                            isLoading={isMutating}
                            className='flex-1 py-2 items-center gap-2 hover:cursor-pointer px-4 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors shadow-xs'
                            onClick={async () => { try { await remove(toDelete.uuid); setToDelete(null); } catch { /* handled */ } }}
                        />
                    </div>
                </div>
            </CustomModal>
        </div>
    );
}

export default AttendanceLogs;
