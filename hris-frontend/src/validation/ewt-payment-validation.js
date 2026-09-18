import * as yup from "yup";

export const ewtPaymentValidationSchema = yup.object().shape({
    atc_code: yup.string().required('ATC code is required'),
    income_payment_amount: yup.number()
        .transform((v, o) => (o === '' ? undefined : v))
        .typeError('Income payment must be a number')
        .required('Income payment is required')
        .moreThan(0, 'Income payment must be greater than 0'),
    tax_withheld_amount: yup.number()
        .transform((v, o) => (o === '' ? undefined : v))
        .typeError('Tax withheld must be a number')
        .required('Tax withheld is required')
        .min(0, 'Tax withheld cannot be negative'),
    payment_date: yup.string().required('Payment date is required'),
    period_year: yup.mixed()
        .test('required', 'Year is required', (v) => v !== '' && v !== null && v !== undefined),
    period_quarter: yup.mixed()
        .test('required', 'Quarter is required', (v) => v !== '' && v !== null && v !== undefined),
    reference_no: yup.string().max(100, 'Reference number cannot exceed 100 characters').nullable(),
});
