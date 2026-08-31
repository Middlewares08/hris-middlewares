import * as yup from "yup";

export const kioskTokenValidationSchema = yup.object().shape({
    token: yup.string()
        .transform((v) => (typeof v === 'string' ? v.trim() : v))
        .required('Enter the kiosk token from HR')
        .min(8, 'That token looks too short'),
});
