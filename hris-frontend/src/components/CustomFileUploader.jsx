import { useState, useRef } from 'react';
import { IoCloudUploadOutline, IoCloseCircle, IoDocumentTextOutline, IoEyeOutline } from 'react-icons/io5';
import { toast } from 'sonner';
import { BLANK } from '../utils/constants';

export function CustomFileUploader({ 
    label, 
    value, 
    onChange, 
    multiple = false, 
    maxFiles = 5, 
    accept = "image/*,application/pdf", 
    description = 'Images or PDFs up to 5MB' 
}) {
    const [isDragging, setIsDragging] = useState(false);
    const [previewTarget, setPreviewTarget] = useState(null);
    const fileInputRef = useRef(null);

    const filesArray = Array.isArray(value) ? value : value ? [value] : [];

    const shouldShowUploader = multiple 
        ? filesArray.length < maxFiles 
        : filesArray.length === 0;

    const isImage = (fileItem) => {
        if (!fileItem) return false;
        if (typeof fileItem === 'string') {
            return fileItem.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null;
        }
        return fileItem.type?.startsWith('image/');
    };

    const getPreviewSrc = (fileItem) => {
        if (!fileItem) return BLANK;
        if (typeof fileItem === 'string') return fileItem;
        return fileItem.previewUrl;
    };

    // 🎯 HELPER: Validates if the file type matches your accept string criteria
    const isValidFileType = (file) => {
        if (!accept) return true;
        const acceptedTypes = accept.split(',').map(t => t.trim());
        
        return acceptedTypes.some(type => {
            if (type.startsWith('.')) {
                // Check extensions (e.g., .pdf, .png)
                return file.name.toLowerCase().endsWith(type.toLowerCase());
            } else if (type.endsWith('/*')) {
                // Check wildcards (e.g., image/*)
                const baseType = type.replace('/*', '');
                return file.type.startsWith(baseType);
            }
            // Check exact MIME type (e.g., application/pdf)
            return file.type === type;
        });
    };

    const processFiles = (incomingFiles) => {
        const fileList = Array.from(incomingFiles);

        // 🎯 1. Sonner validation check for invalid file formats
        const invalidFiles = fileList.filter(file => !isValidFileType(file));
        if (invalidFiles.length > 0) {
            toast.error("Invalid file format", {
                description: `Only ${accept.replace(/image\/\*/g, 'images').toUpperCase()} files are permitted.`
            });
            return;
        }

        // 🎯 2. Sonner validation check for max file count limits
        if (multiple && (filesArray.length + fileList.length) > maxFiles) {
            toast.warning("Upload limit reached", {
                description: `You can only upload a maximum of ${maxFiles} files.`
            });
            return;
        }

        const processedList = fileList.map(file => ({
            file: file,
            name: file.name,
            type: file.type,
            size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
            previewUrl: URL.createObjectURL(file) 
        }));

        if (multiple) {
            onChange([...filesArray, ...processedList]);
        } else {
            onChange(processedList[0] || null);
        }
        
        toast.success(`${fileList.length} ${fileList.length === 1 ? 'file' : 'files'} added successfully.`);
    };

    const removeFile = (e, indexToRemove) => {
        e.stopPropagation(); 
        const targetFile = filesArray[indexToRemove];

        if (targetFile?.previewUrl && typeof targetFile.previewUrl === 'string' && targetFile.previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(targetFile.previewUrl);
        }

        if (multiple) {
            const updatedList = filesArray.filter((_, idx) => idx !== indexToRemove);
            onChange(updatedList.length > 0 ? updatedList : null);
        } else {
            onChange(null);
        }
    };

    return (
        <div className="flex flex-col gap-2 w-full text-left  h-full justify-center">
            {label && <label className="text-sm font-bold text-slate-700">{label}</label>}
            
            {shouldShowUploader ? (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        if (e.dataTransfer.files?.length > 0) processFiles(e.dataTransfer.files);
                    }}
                    className={`relative group w-full min-h-[140px] border-2 border-dashed rounded-[1.5rem] flex flex-col items-center justify-center p-6 cursor-pointer transition-all duration-200 ${
                        isDragging ? 'border-green-600 bg-green-50/30' : 'border-slate-200 hover:border-green-600 hover:bg-slate-50/40'
                    }`}
                >
                    <input 
                        ref={fileInputRef}
                        type="file" 
                        multiple={multiple} 
                        accept={accept}
                        className="hidden" 
                        onChange={(e) => {
                            if (e.target.files?.length > 0) processFiles(e.target.files);
                            if(e.target) e.target.value = ''; 
                        }}
                    />

                    <div className="flex flex-col items-center gap-2 text-center pointer-events-none select-none">
                        <div className="p-3 bg-slate-50 rounded-full text-slate-400 group-hover:text-green-600 group-hover:bg-green-50 transition-colors">
                            <IoCloudUploadOutline size={24} />
                        </div>
                        <div className="text-sm text-slate-600">
                            <span className="font-bold text-green-600">Click to upload</span> or drag and drop
                        </div>
                        <p className="text-xs text-slate-400 font-medium">{description}</p>
                        {multiple && (
                            <p className="text-[10px] text-slate-400 font-mono tracking-wider px-2 py-0.5 border border-slate-100 rounded-full bg-slate-50/50 mt-1">
                                {filesArray.length} / {maxFiles} files uploaded
                            </p>
                        )}
                    </div>
                </div>
            ) : (
                multiple && (
                    <div className="w-full min-h-[60px] border border-slate-100 rounded-xl flex items-center justify-center p-4 bg-slate-50/50 text-xs font-semibold text-slate-500 gap-2 select-none mb-2">
                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"/>
                        Maximum of {maxFiles} files reached. Remove an item to upload more.
                    </div>
                )
            )}

            {filesArray.length > 0 && (
                <div className="flex flex-col gap-2 w-full mt-2">
                    {filesArray.map((fileItem, idx) => (
                        <div 
                            key={fileItem.previewUrl || idx}
                            className="flex items-center gap-4 w-full p-2 bg-slate-50/50 rounded-2xl border border-slate-100 transition-all duration-300 hover:bg-slate-50 animate-fade-in"
                        >
                            <div 
                                onClick={(e) => { e.stopPropagation(); setPreviewTarget(fileItem); }}
                                className="relative group/thumb w-14 h-14 rounded-xl overflow-hidden shadow-xs border border-slate-200 bg-white flex-shrink-0 flex items-center justify-center cursor-zoom-in"
                            >
                                {isImage(fileItem) ? (
                                    <img 
                                        src={getPreviewSrc(fileItem)} 
                                        alt="Thumbnail Preview" 
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-red-500 w-full h-full bg-red-50/30">
                                        <IoDocumentTextOutline size={24} />
                                        <span className="text-[9px] font-extrabold tracking-wider text-red-600 uppercase">PDF</span>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                                    <IoEyeOutline size={16} />
                                </div>
                            </div>

                            <div className="flex flex-col flex-1 min-w-0 gap-0.5 text-left">
                                <span 
                                    onClick={(e) => { e.stopPropagation(); setPreviewTarget(fileItem); }}
                                    className="text-sm font-bold text-slate-800 truncate hover:text-green-600 hover:underline cursor-zoom-in"
                                >
                                    {typeof fileItem === 'string' ? `Document_${idx + 1}` : fileItem.name}
                                </span>
                                <div className="flex items-center gap-2">
                                    {fileItem.size && <span className="text-xs text-slate-400 font-semibold tracking-wide">{fileItem.size}</span>}
                                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                    <span className="text-xs font-bold text-green-600">Ready to save</span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={(e) => removeFile(e, idx)}
                                className="flex items-center justify-center w-8 h-8 rounded-xl bg-white text-slate-400 hover:text-red-500 hover:bg-red-50/50 hover:border-red-100 border border-slate-200 transition-all shadow-xs active:scale-95 flex-shrink-0 mr-1"
                            >
                                <IoCloseCircle size={20} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {previewTarget && (
                <div 
                    className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col items-center justify-center p-4 md:p-10"
                    onClick={() => setPreviewTarget(null)}
                >
                    <div 
                        className="relative w-full max-w-4xl h-[85vh] bg-white rounded-3xl shadow-xl border border-slate-100 flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-sm font-bold text-slate-800 truncate pr-4 text-left">
                                {typeof previewTarget === 'string' ? 'Document Preview' : previewTarget.name}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setPreviewTarget(null)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <IoCloseCircle size={24} />
                            </button>
                        </div>

                        <div className="flex-1 bg-slate-100 flex items-center justify-center p-4 overflow-auto">
                            {isImage(previewTarget) ? (
                                <img 
                                    src={getPreviewSrc(previewTarget)} 
                                    alt="Full scale media viewport view" 
                                    className="max-w-full max-h-full object-contain rounded-lg shadow-xs"
                                />
                            ) : (
                                <iframe 
                                    src={getPreviewSrc(previewTarget)} 
                                    title="Interactive PDF Viewer Canvas"
                                    className="w-full h-full rounded-lg bg-white border border-slate-200"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}