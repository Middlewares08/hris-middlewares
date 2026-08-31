import * as yup from "yup";

export const payrollRunValidationSchema = yup.object().shape({
    pay_period_id: yup.mixed()
        .test('required', 'Pay period is required', (v) => v !== '' && v !== null && v !== undefined),
    run_type: yup.string().required('Run type is required'),
    notes: yup.string().max(500, 'Notes cannot exceed 500 characters').nullable(),
});
