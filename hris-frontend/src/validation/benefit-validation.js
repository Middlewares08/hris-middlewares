import * as Yup from 'yup';

// Helper regex patterns matching your exact format examples
const SSS_REGEX = /^\d{2}-\d{7}-\d{1}$/;          // 12-1234567-1
const PHILHEALTH_REGEX = /^\d{2}-\d{9}-\d{1}$/;   // 12-123456789-1
const PAGIBIG_REGEX = /^\d{4}-\d{4}-\d{4}$/;      // 1234-1234-1234
const TIN_REGEX = /^\d{3}-\d{3}-\d{3}-\d{3}$/;    // 123-123-123-123

export const benefitValidationSchema = Yup.object().shape({
    // Exemption flags (optional booleans, default to false)
    is_sss_exempt: Yup.boolean().optional(),
    is_philhealth_exempt: Yup.boolean().optional(),
    is_pagibig_exempt: Yup.boolean().optional(),

    // SSS Validation
    sss: Yup.string()
        .nullable()
        .optional()
        .when('is_sss_exempt', {
            is: true,
            then: (schema) => schema.notRequired(),
            otherwise: (schema) =>
                schema.test(
                    'sss-format',
                    'SSS number must follow the format XX-XXXXXXX-X (e.g. 12-1234567-1)',
                    (val) => !val || SSS_REGEX.test(val) // Validates format only if data exists
                ),
        }),

    // PhilHealth Validation
    philhealth: Yup.string()
        .nullable()
        .optional()
        .when('is_philhealth_exempt', {
            is: true,
            then: (schema) => schema.notRequired(),
            otherwise: (schema) =>
                schema.test(
                    'philhealth-format',
                    'PhilHealth number must follow the format XX-XXXXXXXXX-X (e.g. 12-123456789-1)',
                    (val) => !val || PHILHEALTH_REGEX.test(val)
                ),
        }),

    // Pag-IBIG Validation
    pagibig: Yup.string()
        .nullable()
        .optional()
        .when('is_pagibig_exempt', {
            is: true,
            then: (schema) => schema.notRequired(),
            otherwise: (schema) =>
                schema.test(
                    'pagibig-format',
                    'Pag-IBIG MID must follow the format XXXX-XXXX-XXXX (e.g. 1234-1234-1234)',
                    (val) => !val || PAGIBIG_REGEX.test(val)
                ),
        }),

    // TIN Validation (Optional, standard format check)
    tin: Yup.string()
        .nullable()
        .optional()
        .test(
            'tin-format',
            'TIN must follow the format XXX-XXX-XXX-XXX (e.g. 123-123-123-123)',
                (val) => !val || TIN_REGEX.test(val)
        ),
});