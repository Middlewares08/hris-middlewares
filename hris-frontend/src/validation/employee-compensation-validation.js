import * as yup from "yup";

const positiveNumber = (label) =>
    yup.number()
        .transform((v, o) => (o === '' ? undefined : v))
        .typeError(`${label} must be a number`)
        .required(`${label} is required`)
        .moreThan(0, `${label} must be greater than 0`);

export const employeeCompensationValidationSchema = yup.object().shape({
    employee_id: yup.mixed()
        .test('required', 'Employee is required', (v) => v !== '' && v !== null && v !== undefined),
    pay_rate: positiveNumber('Pay rate'),
    rate_type: yup.string().required('Rate type is required'),
    working_days_per_month: yup.number()
        .transform((v, o) => (o === '' ? undefined : v))
        .typeError('Work days/mo must be a number')
        .min(1, 'Work days/mo must be at least 1')
        .max(31, 'Work days/mo cannot exceed 31'),
    working_hours_per_day: yup.number()
        .transform((v, o) => (o === '' ? undefined : v))
        .typeError('Work hrs/day must be a number')
        .min(1, 'Work hrs/day must be at least 1')
        .max(24, 'Work hrs/day cannot exceed 24'),
    pay_frequency: yup.string().required('Frequency is required'),
    effective_date: yup.string().required('Effective date is required'),
    end_date: yup.string()
        .nullable()
        .test('after-effective', 'End date must be after the effective date', function (value) {
            const { effective_date } = this.parent;
            if (!value || !effective_date) return true;
            return new Date(value) > new Date(effective_date);
        }),
    tax_status: yup.string().max(10, 'Tax status cannot exceed 10 characters').nullable(),
    payment_method: yup.string().required('Payment method is required'),
    bank_name: yup.string().max(100, 'Bank name cannot exceed 100 characters').nullable(),
    bank_account_name: yup.string().max(150, 'Account name cannot exceed 150 characters').nullable(),
    bank_account_number: yup.string().max(50, 'Account number cannot exceed 50 characters').nullable(),
    remarks: yup.string().max(500, 'Remarks cannot exceed 500 characters').nullable(),
});
