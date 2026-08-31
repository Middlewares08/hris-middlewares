import * as yup from "yup";

// Employee + date are only editable (and thus required) when creating a new record.
export const attendanceLogValidationSchema = (isEdit = false) =>
    yup.object().shape({
        employee_id: isEdit
            ? yup.mixed().nullable()
            : yup.mixed()
                .test('required', 'Employee is required', (v) => v !== '' && v !== null && v !== undefined),
        log_date: isEdit
            ? yup.string().nullable()
            : yup.string().required('Date is required'),
        time_in: yup.string().nullable(),
        time_out: yup.string()
            .nullable()
            .test(
                'after-time-in',
                'Time out must be after time in',
                function (value) {
                    const { time_in } = this.parent;
                    if (!value || !time_in) return true;
                    return value > time_in;
                }
            ),
        status: yup.string().required('Status is required'),
        source: yup.string().required('Source is required'),
        remarks: yup.string().max(500, 'Remarks cannot exceed 500 characters').nullable(),
    });
