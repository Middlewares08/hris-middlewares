import * as yup from "yup";

export const payrollAdjustmentValidationSchema = yup.object().shape({
    employee_id: yup.mixed()
        .test('required', 'Employee is required', (v) => v !== '' && v !== null && v !== undefined),
    adjustment_type: yup.string().required('Type is required'),
    amount: yup.number()
        .transform((v, o) => (o === '' ? undefined : v))
        .typeError('Amount must be a number')
        .required('Amount is required')
        .moreThan(0, 'Amount must be greater than 0'),
    label: yup.string()
        .required('Label is required')
        .max(150, 'Label cannot exceed 150 characters'),
    reason: yup.string()
        .required('Reason is required')
        .max(300, 'Reason cannot exceed 300 characters'),
});
