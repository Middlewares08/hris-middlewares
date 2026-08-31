import * as Yup from 'yup';

const PAYMENT_METHODS = ['bank_transfer', 'cash', 'check'];

export const bankDetailValidationSchema = Yup.object().shape({
    payment_method: Yup.string()
        .oneOf(PAYMENT_METHODS, 'Choose a valid payment method')
        .nullable(),

    bank_name: Yup.string().nullable().max(150, 'Bank name is too long'),

    bank_account_name: Yup.string().nullable().max(150, 'Account name is too long'),

    // Optional: only overwrites the stored number when a value is typed.
    // Digits, spaces and dashes only, 4–25 chars.
    bank_account_number: Yup.string()
        .nullable()
        .max(50, 'Account number is too long')
        .test(
            'account-format',
            'Account number should be 4–25 digits (spaces / dashes allowed)',
            (val) => !val || /^[0-9\s-]{4,25}$/.test(val),
        ),
});
