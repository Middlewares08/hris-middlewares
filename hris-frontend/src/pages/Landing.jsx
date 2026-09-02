import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Users,
    Wallet,
    Fingerprint,
    ShieldCheck,
    CalendarClock,
    Megaphone,
    ArrowRight,
    MonitorSmartphone,
    LifeBuoy,
} from 'lucide-react';
import ContactAdminModal from '../components/ContactAdminModal';

const FEATURES = [
    {
        icon: Users,
        title: 'Employee directory',
        body: 'One record per person — identity, job profile, compensation history, roles, and documents.',
    },
    {
        icon: Wallet,
        title: 'Payroll runs',
        body: 'Pay periods, statutory tables, pay components, and reviewable runs with branded payslips.',
    },
    {
        icon: Fingerprint,
        title: 'Attendance & kiosk',
        body: 'Verified clock-ins, an unattended face-recognition kiosk, and full attendance logs.',
    },
    {
        icon: CalendarClock,
        title: 'Overtime & leave',
        body: 'File, approve, and feed approved hours straight into the payroll engine.',
    },
    {
        icon: ShieldCheck,
        title: 'Roles & permissions',
        body: 'Granular, scope-aware access control for both the admin console and the employee app.',
    },
    {
        icon: Megaphone,
        title: 'Announcements & documents',
        body: 'Broadcast company notices and fulfil employee document and payslip requests.',
    },
];

function Landing() {
    const isAuthed = Boolean(localStorage.getItem('accessToken'));
    const [contactOpen, setContactOpen] = useState(false);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
            {/* Nav */}
            <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
                <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-linear-to-br from-violet-600 to-indigo-600 text-white shadow-sm">
                        <Users size={18} />
                    </span>
                    <span className="text-base font-semibold tracking-tight">
                        HRIS <span className="text-slate-400">Console</span>
                    </span>
                </div>
                <Link
                    to={isAuthed ? '/dashboard' : '/auth/login'}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                >
                    {isAuthed ? 'Open console' : 'Sign in'}
                </Link>
            </header>

            {/* Hero */}
            <section className="mx-auto max-w-6xl px-6 pb-16 pt-12 sm:pt-20">
                <div className="mx-auto max-w-3xl text-center">
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Workforce operations, centralised
                    </span>
                    <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-700! sm:text-5xl">
                        The control center for
                        <span className="bg-linear-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                            {' '}your people operations
                        </span>
                    </h1>
                    <div className=' flex flex-col items-center justify-center'>
                        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-600">
                            Manage employees, run payroll, track attendance, and control access — all from one
                            admin console, backed by a self-service app your team actually uses.
                        </p>
                    </div>
                   
                    <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <Link
                            to={isAuthed ? '/dashboard' : '/auth/login'}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 sm:w-auto"
                        >
                            {isAuthed ? 'Go to dashboard' : 'Open the console'}
                            <ArrowRight size={16} />
                        </Link>
                        <Link
                            to="/kiosk"
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 sm:w-auto"
                        >
                            <MonitorSmartphone size={16} />
                            Launch attendance kiosk
                        </Link>
                    </div>
                    <p className="pt-4 text-xs text-slate-400">
                        Can't get in?{' '}
                        <button
                            type="button"
                            onClick={() => setContactOpen(true)}
                            className="font-medium text-indigo-600 underline-offset-2 hover:underline"
                        >
                            Contact an admin
                        </button>
                    </p>
                </div>

                {/* Features */}
                <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {FEATURES.map(({ icon: Icon, title, body }) => (
                        <div
                            key={title}
                            className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                        >
                            <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700">
                                <Icon size={18} />
                            </span>
                            <h3 className="mt-4 text-sm font-semibold text-slate-900">{title}</h3>
                            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{body}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-slate-200/70">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-slate-400 sm:flex-row">
                    <span>&copy; {new Date().getFullYear()} HRIS Middleware. Internal use only.</span>
                    <div className="flex items-center gap-4">
                        <Link to="/auth/login" className="hover:text-slate-600">Admin sign in</Link>
                        <Link to="/kiosk" className="hover:text-slate-600">Kiosk</Link>
                        <button
                            type="button"
                            onClick={() => setContactOpen(true)}
                            className="inline-flex items-center gap-1 hover:text-slate-600"
                        >
                            <LifeBuoy size={12} /> Contact an admin
                        </button>
                    </div>
                </div>
            </footer>

            <ContactAdminModal
                isOpen={contactOpen}
                onClose={() => setContactOpen(false)}
                source="admin-console · landing"
            />
        </div>
    );
}

export default Landing;
