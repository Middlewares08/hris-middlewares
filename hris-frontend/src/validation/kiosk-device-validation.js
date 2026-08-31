import * as yup from "yup";

export const kioskDeviceValidationSchema = yup.object().shape({
    name: yup.string()
        .required('Device name is required')
        .max(100, 'Device name cannot exceed 100 characters'),
    location: yup.string()
        .max(150, 'Location cannot exceed 150 characters')
        .nullable(),
});
