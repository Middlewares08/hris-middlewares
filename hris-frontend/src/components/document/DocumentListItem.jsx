import { useState } from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import { FileText, Image as ImageIcon, Download, Trash } from 'lucide-react';
import DocumentPreviewModal from './DocumentPreviewModal';

const fmtDate = (v) => (v ? moment(v).format('MMM D, YYYY') : '—');
const fmtSize = (b) => (b ? `${(Number(b) / 1024 / 1024).toFixed(2)} MB` : '');

/**
 * A single row in an employee's document library (admin view): click the name
 * to preview the file in a modal, download it, or archive it.
 */
function DocumentListItem({ document: d, onDelete, canDelete = false }) {
    const [previewing, setPreviewing] = useState(false);
    const href = d.file_url || d.file_link;

    return (
        <li className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <button
                type="button"
                onClick={() => setPreviewing(true)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:cursor-pointer hover:text-slate-700"
                title="View file"
            >
                {d.type === 'image' ? <ImageIcon size={16} /> : <FileText size={16} />}
            </button>
            <button
                type="button"
                onClick={() => setPreviewing(true)}
                className="group min-w-0 flex-1 cursor-pointer text-left"
                title="View file"
            >
                <p className="truncate text-sm font-medium text-slate-800 group-hover:text-blue-600 group-hover:underline">{d.label}</p>
                <p className="text-[11px] text-slate-400">
                    {d.source === 'employee' ? 'Uploaded by employee' : 'Added by HR'} · {fmtDate(d.created_at)}
                    {fmtSize(d.size_bytes) && ` · ${fmtSize(d.size_bytes)}`}
                </p>
            </button>
            <a
                href={href}
                target="_blank"
                rel="noreferrer"
                download={d.file_name || d.label}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
                title="Open / download"
            >
                <Download size={15} />
            </a>
            {canDelete && (
                <button
                    type="button"
                    onClick={() => onDelete(d)}
                    className="rounded-lg p-1.5 text-slate-400 hover:cursor-pointer hover:bg-white hover:text-rose-600"
                    title="Archive"
                >
                    <Trash size={15} />
                </button>
            )}

            {previewing && <DocumentPreviewModal document={d} onClose={() => setPreviewing(false)} />}
        </li>
    );
}

DocumentListItem.propTypes = {
    document: PropTypes.object.isRequired,
    onDelete: PropTypes.func,
    canDelete: PropTypes.bool,
};

export default DocumentListItem;
