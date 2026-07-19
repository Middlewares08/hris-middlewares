import * as yup from "yup";

export const basicInfoValidationSchema = yup.object().shape({
    firstname: yup
        .string()
        .trim()
        .required("First name is required")
        .min(2, "First name must be at least 2 characters"),
    lastname: yup
        .string()
        .trim()
        .required("Last name is required")
        .min(2, "Last name must be at least 2 characters"),
    email: yup
        .string()
        .trim()
        .required("Email address is required")
        .email("Please enter a valid email address")
});


export const employmentValidationSchema = yup.object().shape({
    employment_type: yup
        .string()
        .required("Employment type is required"),
    date_hired: yup
        .string()
        .required("Date hired is required"),
    position: yup
        .number()
        .required("Position is required")
});


export const contactInfoValidationSchema = yup.object().shape({
    phone_number: yup.string()
        .required('Phone number is required')
        .matches(
            /^09\d{2}-\d{3}-\d{4}$/,
            'Phone number must be a valid Philippine mobile number (09XX-XXX-XXXX)'
        ),
    personal_email: yup
        .string()
        .trim()
        .required("Personal email address is required")
        .email("Please enter a valid email address")
});