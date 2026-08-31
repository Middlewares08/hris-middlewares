import * as yup from "yup";

export const payPeriodValidationSchema = yup.object().shape({
    name: yup.string()
        .required('Name is required')
        .max(100, 'Name cannot exceed 100 characters'),
    period_start: yup.string().required('Period start is required'),
    period_end: yup.string()
        .required('Period end is required')
        .test('after-start', 'Period end must be after the start date', function (value) {
            const { period_start } = this.parent;
            if (!value || !period_start) return true;
            return new Date(value) >= new Date(period_start);
        }),
    pay_date: yup.string().required('Pay date is required'),
    frequency: yup.string().required('Frequency is required'),
    sequence: yup.string().required('Sequence is required'),
    status: yup.string().required('Status is required'),
    remarks: yup.string().max(500, 'Remarks cannot exceed 500 characters').nullable(),
});
