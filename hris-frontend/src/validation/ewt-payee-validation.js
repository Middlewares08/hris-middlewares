import * as yup from "yup";

export const ewtPayeeValidationSchema = yup.object().shape({
    payee_type: yup.string().required('Payee type is required'),
    registered_name: yup.string()
        .required('Registered name is required')
        .max(200, 'Registered name cannot exceed 200 characters'),
    trade_name: yup.string().max(200, 'Trade name cannot exceed 200 characters').nullable(),
    tin: yup.string()
        .required('TIN is required')
        .test('digits9', 'TIN must be 9 digits', (v) => String(v || '').replace(/\D/g, '').length === 9),
    tin_branch: yup.string().nullable(),
    address_line1: yup.string().max(200, 'Address cannot exceed 200 characters').nullable(),
    city: yup.string().max(120, 'City cannot exceed 120 characters').nullable(),
    province: yup.string().max(120, 'Province cannot exceed 120 characters').nullable(),
    zip_code: yup.string().max(10, 'Zip code cannot exceed 10 characters').nullable(),
    contact_email: yup.string().email('Enter a valid email').nullable(),
});
