import PropTypes from 'prop-types';
import { ResponsiveContainer } from 'recharts';

/**
 * Titled white card wrapping a fixed-height Recharts chart.
 * Renders an "empty" placeholder instead of a broken chart when there's no data.
 */
function ChartCard({ title, subtitle, height = 260, isEmpty = false, children }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3">
                <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
                {subtitle ? <p className="text-xs text-slate-400">{subtitle}</p> : null}
            </div>

            {isEmpty ? (
                <div
                    className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400"
                    style={{ height }}
                >
                    No data for this period
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={height}>
                    {children}
                </ResponsiveContainer>
            )}
        </div>
    );
}

ChartCard.propTypes = {
    title: PropTypes.string.isRequired,
    subtitle: PropTypes.string,
    height: PropTypes.number,
    isEmpty: PropTypes.bool,
    children: PropTypes.element,
};

export default ChartCard;
