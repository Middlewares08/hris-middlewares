import { useState } from 'react';
import PropTypes from 'prop-types';
import { Send, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../api/index';
import CustomModal from './CustomModal';
import CustomInput from './CustomInput';
import CustomButton from './CustomButton';

const EMPTY = { name: '', email: '', message: '' };

/**
 * "Contact an admin" — an unauthenticated help channel shown on the landing and
 * login screens for people who can't get into the app. Posts to the public
 * /public/contact-admin endpoint.
 */
function ContactAdminModal({ isOpen, onClose, source = 'employee-app' }) {
    const [form, setForm] = useState(EMPTY);
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);

    const set = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    const validate = () => {
        const next = {};
        if (!form.name.trim()) next.name = 'Your name is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email';
        if (form.message.trim().length < 10) next.message = 'Please add a bit more detail (10+ characters)';
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const close = () => {
        onClose();
        // Reset a beat later so the form doesn't flash while the modal animates out.
        setTimeout(() => {
            setForm(EMPTY);
            setErrors({});
            setSent(false);
        }, 200);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitting || !validate()) return;

        setSubmitting(true);
        try {
            await apiClient.post('/public/contact-admin', {
                name: form.name.trim(),
                email: form.email.trim(),
                message: form.message.trim(),
                source,
            });
            setSent(true);
        } catch (err) {
            const status = err?.response?.status;
            const msg =
                err?.response?.data?.message ||
                err?.response?.data?.errors?.[0]?.msg ||
                (status === 429
                    ? "You've sent a few messages already. Please try again later."
                    : 'Could not send your message. Please try again later.');
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <CustomModal
            isOpen={isOpen}
            onClose={close}
            title={sent ? 'Message sent' : 'Contact an administrator'}
            size="md"
            showCloseButton
            hasRequiredFields={!sent}
        >
            {sent ? (
                <div className="flex flex-col items-center gap-3 px-2 py-6 text-center">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                        <CheckCircle2 size={26} />
                    </span>
                    <p className="text-sm text-slate-600">
                        Thanks — an administrator has been notified and will reach out at{' '}
                        <span className="font-medium text-slate-800">{form.email}</span>.
                    </p>
                    <CustomButton children="Done" onClick={close} variant="primary" className="mt-2" />
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4 px-1 py-2 scrollbar-y-visible overflow-y-auto max-h-[60vh]">
                    <p className="text-sm text-slate-500">
                        Locked out or need help getting access? Send a note and an administrator will get back to you.
                    </p>

                    <CustomInput
                        label="Your name"
                        labelPosition="left"
                        isRequired
                        maxLength={120}
                        placeholder="Juan dela Cruz"
                        value={form.name}
                        onChange={(e) => set('name', e.target.value)}
                        error={!!errors.name}
                        errorLabel={errors.name}
                    />

                    <CustomInput
                        label="Your work email"
                        labelPosition="left"
                        isRequired
                        type="email"
                        maxLength={120}
                        placeholder="you@example.com"
                        value={form.email}
                        onChange={(e) => set('email', e.target.value)}
                        error={!!errors.email}
                        errorLabel={errors.email}
                    />

                    <div className="space-y-1">
                        <label className="block text-left text-sm font-medium text-slate-700">
                            How can we help? <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                            rows={4}
                            maxLength={2000}
                            placeholder="Describe the problem — e.g. I can't sign in and the reset code never arrives."
                            value={form.message}
                            onChange={(e) => set('message', e.target.value)}
                            className={`w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:ring-2 ${
                                errors.message
                                    ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-500'
                                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                            }`}
                        />
                        {errors.message && <p className="text-left text-xs text-rose-500">{errors.message}</p>}
                    </div>
                            
                    <div className='flex justify-end w-full'>
                        <CustomButton
                            children={submitting ? 'Sending…' : 'Send message'}
                            type="submit"
                            icon={Send}
                            iconPosition="right"
                            isLoading={submitting}
                            disabled={submitting}
                            variant="primary"
                            className='flex py-2 items-center gap-2 hover:cursor-pointer px-4 bg-slate-700 text-white rounded-lg text-sm! font-medium hover:bg-slate-600 transition-colors shadow-xs'
                        />
                        
                    </div>
                    
                </form>
            )}
        </CustomModal>
    );
}

ContactAdminModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    source: PropTypes.string,
};

export default ContactAdminModal;
