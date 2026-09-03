// src/module/admin/services/govFilings/formats/writers.js
//
// Low-level formatting helpers shared by every government file writer.
// Kept dumb on purpose: no business logic, just string shaping.

/** Two-decimal fixed string, no thousands separators (e.g. 1234.50). */
const money = (v) => {
    const n = Number(v);
    return (Number.isFinite(n) ? n : 0).toFixed(2);
};

/** Integer string. */
const int = (v) => String(Math.round(Number(v) || 0));

/** Digits only. */
const digits = (v) => String(v ?? '').replace(/\D/g, '');

/** Uppercase, trimmed, collapse internal whitespace. */
const upper = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

/** Strip characters that would break a delimited field. */
const clean = (v, delimiter = ',') => String(v ?? '').replace(new RegExp(`[${delimiter}\\r\\n]`, 'g'), ' ').trim();

/** Left-pad to width with `pad` (numbers). */
const padL = (v, width, pad = '0') => String(v ?? '').slice(0, width).padStart(width, pad);

/** Right-pad / truncate to width (fixed-width text fields). */
const fit = (v, width, pad = ' ') => String(v ?? '').slice(0, width).padEnd(width, pad);

/** YYYYMMDD */
const ymd8 = (v) => {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};

/** MM/DD/YYYY */
const mdy = (v) => {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};

/** MM/YYYY applicable-period stamp. */
const monthYear = (year, month) => `${String(month).padStart(2, '0')}/${year}`;

/** TIN as 000000000000 (9 base + 3 branch). */
const tin12 = (tin, branch = '000') => {
    const base = padL(digits(tin), 9);
    const br = padL(digits(branch) || '000', 3);
    return `${base}${br}`;
};

/** SSS number as NN-NNNNNNN-N when 10 digits are present, else raw digits. */
const sssNo = (v) => {
    const d = digits(v);
    return d.length === 10 ? `${d.slice(0, 2)}-${d.slice(2, 9)}-${d.slice(9)}` : d;
};

/** PhilHealth PIN as NN-NNNNNNNNN-N when 12 digits, else raw. */
const philId = (v) => {
    const d = digits(v);
    return d.length === 12 ? `${d.slice(0, 2)}-${d.slice(2, 11)}-${d.slice(11)}` : d;
};

/** Pag-IBIG MID as NNNN-NNNN-NNNN when 12 digits, else raw. */
const pagibigId = (v) => {
    const d = digits(v);
    return d.length === 12 ? `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8)}` : d;
};

/** Join fields into one delimited record, cleaning each cell. */
const row = (fields, delimiter = ',') => fields.map((f) => clean(f, delimiter)).join(delimiter);

/** Assemble lines into a file body with CRLF (what agency validators expect). */
const file = (lines) => lines.join('\r\n') + '\r\n';

/** CSV with a header row. `columns` = [{key,label,map?}]. */
const csv = (columns, rows) => {
    const esc = (v) => {
        const s = v == null ? '' : String(v);
        return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = columns.map((c) => esc(c.label)).join(',');
    const body = rows.map((r) => columns.map((c) => esc(c.map ? c.map(r) : r[c.key])).join(',')).join('\r\n');
    return `${head}\r\n${body}\r\n`;
};

module.exports = {
    money, int, digits, upper, clean, padL, fit,
    ymd8, mdy, monthYear, tin12, sssNo, philId, pagibigId,
    row, file, csv,
};
