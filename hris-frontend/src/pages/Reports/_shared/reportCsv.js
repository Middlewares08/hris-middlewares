import { downloadBlob } from '../../../utils/downloadBlob';

const escapeCell = (v) => {
    if (v == null) return '';
    const s = Array.isArray(v) ? v.join(' | ') : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Turn an array of row objects into CSV and trigger a browser download.
 *
 * @param {string} filename           without extension
 * @param {Array<object>} rows
 * @param {Array<{key:string,label:string}>} [columns]  column order/labels; defaults to keys of the first row
 */
export function exportRowsToCsv(filename, rows, columns) {
    const list = Array.isArray(rows) ? rows : [];
    const cols = columns && columns.length
        ? columns
        : Object.keys(list[0] || {}).map((key) => ({ key, label: key }));

    const header = cols.map((c) => escapeCell(c.label)).join(',');
    const body = list.map((row) => cols.map((c) => escapeCell(row[c.key])).join(',')).join('\n');
    const csv = `${header}\n${body}`;

    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${filename}-${stamp}.csv`);
}
