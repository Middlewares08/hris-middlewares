// Shared Recharts theme — validated categorical palette (data-viz reference
// instance, light mode) + axis / grid / tooltip styling. Used by the Reports
// pages and the Overview dashboard.

export const C = {
    blue: '#2a78d6',
    orange: '#eb6834',
    aqua: '#1baf7a',
    yellow: '#eda100',
    magenta: '#e87ba4',
    violet: '#4a3aa7',
    green: '#008300',
    red: '#e34948',
};

export const CATEGORICAL = [C.blue, C.orange, C.aqua, C.yellow, C.magenta, C.violet, C.green, C.red];

export const AXIS_TICK = { fontSize: 11, fill: '#94a3b8' };
export const GRID_STROKE = '#e2e8f0';
export const TOOLTIP_STYLE = {
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    fontSize: 12,
    boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
};

export const peso = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
});
export const pesoCompact = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    notation: 'compact',
    maximumFractionDigits: 1,
});

export const titleCase = (v) => String(v || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
