import PropTypes from 'prop-types';
import { useEffect } from 'react';
import { IoCloseCircle } from 'react-icons/io5';
import { Download } from 'lucide-react';

const looksLikeImage = (d) => {
    if (!d) return false;
    if (d.type === 'image') return true;
    const src = d.file_url || d.file_link || d.file_name || '';
    return /\.(jpe?g|gif|png|webp|bmp|svg)(\?|$)/i.test(src);
};

/**
 * Full-screen preview of a stored document — images render inline, everything
 * else (PDFs, etc.) loads in an iframe. Mirrors the CustomFileUploader viewer.
 */
function DocumentPreviewModal({ document: d, onClose }) {
    useEffect(() => {
        if (!d) return undefined;
        const onKey = (e) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [d, onClose]);

    if (!d) return null;

    const src = d.file_url || d.file_link;

    return (
        <div
            className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs md:p-10"
            onClick={onClose}
        >
            <div
                className="relative flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                    <h3 className="truncate pr-4 text-left text-sm font-bold text-slate-800">{d.label}</h3>
                    <div className="flex items-center gap-1">
                        <a
                            href={src}
                            target="_blank"
                            rel="noreferrer"
                            download={d.file_name || d.label}
                            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                            title="Download"
                        >
                            <Download size={20} />
                        </a>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                        >
                            <IoCloseCircle size={24} />
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 items-center justify-center overflow-auto bg-slate-100 p-4">
                    {looksLikeImage(d) ? (
                        <img
                            src={src}
                            alt={d.label}
                            className="max-h-full max-w-full rounded-lg object-contain shadow-xs"
                        />
                    ) : (
                        <iframe
                            src={src}
                            title={d.label}
                            className="h-full w-full rounded-lg border border-slate-200 bg-white"
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

DocumentPreviewModal.propTypes = {
    document: PropTypes.object,
    onClose: PropTypes.func.isRequired,
};

export default DocumentPreviewModal;
