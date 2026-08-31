import * as yup from "yup";

export const announcementValidationSchema = yup.object().shape({
    title: yup.string()
        .required('Title is required')
        .max(150, 'Title cannot exceed 150 characters'),
    body: yup.string()
        .required('Body is required')
        .max(5000, 'Body cannot exceed 5000 characters'),
    priority: yup.string().required('Priority is required'),
    status: yup.string().required('Status is required'),
    link_url: yup.string()
        .transform((v) => (v === '' ? null : v))
        .url('Enter a valid URL (https://...)')
        .nullable(),
    expires_at: yup.mixed()
        .nullable()
        .test(
            'after-publish',
            'Expiry must be after the publish date',
            function (value) {
                const { published_at } = this.parent;
                if (!value || !published_at) return true;
                return new Date(value) > new Date(published_at);
            }
        ),
});
