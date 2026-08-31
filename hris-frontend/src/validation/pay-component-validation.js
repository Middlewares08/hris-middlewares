import * as yup from "yup";

export const payComponentValidationSchema = yup.object().shape({
    code: yup.string()
        .required('Code is required')
        .max(50, 'Code cannot exceed 50 characters')
        .matches(/^[A-Z0-9_]+$/, 'Use uppercase letters, numbers and underscores only'),
    name: yup.string()
        .required('Name is required')
        .max(100, 'Name cannot exceed 100 characters'),
    description: yup.string()
        .max(300, 'Description cannot exceed 300 characters')
        .nullable(),
    component_type: yup.string().required('Type is required'),
    calculation_type: yup.string().required('Calculation type is required'),
    default_amount: yup.number()
        .transform((v, o) => (o === '' ? null : v))
        .typeError('Default amount must be a number')
        .min(0, 'Default amount cannot be negative')
        .nullable(),
    default_rate: yup.number()
        .transform((v, o) => (o === '' ? null : v))
        .typeError('Default rate must be a number')
        .min(0, 'Default rate cannot be negative')
        .nullable(),
    display_order: yup.number()
        .transform((v, o) => (o === '' ? 0 : v))
        .typeError('Display order must be a number')
        .min(0, 'Display order cannot be negative'),
});
