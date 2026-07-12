import * as yup from "yup";

export const positionValidationSchema = yup.object().shape({
    name: yup.string()
        .required('Position name is required')
        .max(50, 'Position name cannot exceed 50 characters')
        // Reject special characters (Allows only letters, numbers, and spaces)
        .matches(/^[a-zA-Z0-9 ]+$/, 'Special characters are not allowed')
        // Strict Character Count (Ignores spaces when checking the min limit)
        .test(
            'min-letters', 
            'Position must be at least 2 actual characters', 
            (value) => {
                if (!value) return false;
                return value.replace(/\s/g, '').length >= 2;
            }
        ),
    department:  yup.string().required('Department is required'),
    description: yup.string()
        .max(300, 'Description cannot exceed 300 characters')
        .nullable()
});