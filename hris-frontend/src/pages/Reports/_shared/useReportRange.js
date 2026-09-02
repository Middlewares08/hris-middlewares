import { useMemo, useState } from 'react';

const ymd = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

/**
 * Date-range state for a report filter. Matches the backend `parseRange` defaults.
 *
 * @param {number|'ytd'} preset  trailing-day count, or 'ytd' for calendar year-to-date
 */
export function useReportRange(preset = 30) {
    const initial = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const to = ymd(today);
        if (preset === 'ytd') return { from: `${today.getFullYear()}-01-01`, to };
        const from = new Date(today);
        from.setDate(from.getDate() - (preset - 1));
        return { from: ymd(from), to };
    }, [preset]);

    const [range, setRange] = useState(initial);

    return {
        range,
        setFrom: (from) => setRange((r) => ({ ...r, from })),
        setTo: (to) => setRange((r) => ({ ...r, to })),
        reset: () => setRange(initial),
        // params for the report hook — only send valid dates
        params: {
            ...(range.from ? { dateFrom: range.from } : {}),
            ...(range.to ? { dateTo: range.to } : {}),
        },
    };
}
