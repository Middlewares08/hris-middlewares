import PropTypes from 'prop-types';

const TONES = {
    slate: 'bg-slate-100 text-slate-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    violet: 'bg-violet-50 text-violet-600',
};

/**
 * A single KPI tile for the dashboard — label, big value, lucide icon, optional hint.
 */
function StatCard({ label, value, hint, icon: Icon, tone = 'slate' }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
                    <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
                    {hint ? <p className="mt-0.5 text-xs text-slate-400">{hint}</p> : null}
                </div>
                {Icon ? (
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONES[tone] || TONES.slate}`}>
                        <Icon size={16} />
                    </div>
                ) : null}
            </div>
        </div>
    );
}

StatCard.propTypes = {
    label: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    hint: PropTypes.string,
    icon: PropTypes.elementType,
    tone: PropTypes.oneOf(Object.keys(TONES)),
};

export default StatCard;
