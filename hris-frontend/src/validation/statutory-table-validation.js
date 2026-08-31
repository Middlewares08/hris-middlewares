import * as yup from "yup";

const optionalNonNegative = (msg) =>
    yup.number()
        .transform((v, o) => (o === '' ? null : v))
        .typeError(`${msg} must be a number`)
        .min(0, `${msg} cannot be negative`)
        .nullable();

export const statutoryTableValidationSchema = yup.object().shape({
    type: yup.string().required('Type is required'),
    label: yup.string()
        .required('Label is required')
        .max(150, 'Label cannot exceed 150 characters'),
    effective_from: yup.string().required('Effective from date is required'),
    effective_to: yup.string()
        .nullable()
        .test(
            'after-effective-from',
            'Effective to must be after effective from',
            function (value) {
                const { effective_from } = this.parent;
                if (!value || !effective_from) return true;
                return new Date(value) >= new Date(effective_from);
            }
        ),
    frequency: yup.string().required('Frequency is required'),
    computation_type: yup.string().required('Computation method is required'),

    employee_rate_pct: yup.mixed().when('computation_type', {
        is: 'flat_percentage',
        then: () =>
            yup.number()
                .transform((v, o) => (o === '' ? undefined : v))
                .typeError('Employee rate must be a number')
                .required('Employee rate is required')
                .min(0, 'Employee rate cannot be negative')
                .max(100, 'Employee rate cannot exceed 100%'),
        otherwise: () => yup.mixed().nullable(),
    }),
    employer_rate_pct: yup.mixed().when('computation_type', {
        is: 'flat_percentage',
        then: () =>
            yup.number()
                .transform((v, o) => (o === '' ? undefined : v))
                .typeError('Employer rate must be a number')
                .required('Employer rate is required')
                .min(0, 'Employer rate cannot be negative')
                .max(100, 'Employer rate cannot exceed 100%'),
        otherwise: () => yup.mixed().nullable(),
    }),

    salary_floor: optionalNonNegative('Salary floor'),
    salary_ceiling: optionalNonNegative('Salary ceiling'),
    salary_rounding: optionalNonNegative('Salary rounding'),
    ec_amount: optionalNonNegative('Employer EC'),

    brackets: yup.array().when('computation_type', {
        is: (v) => v && v !== 'flat_percentage',
        then: (schema) => schema.min(1, 'Add at least one salary band'),
        otherwise: (schema) => schema,
    }),
});
