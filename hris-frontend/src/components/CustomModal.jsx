'use client';
import { useEffect } from 'react';
import PropTypes from 'prop-types'; 
import { motion, AnimatePresence } from 'framer-motion';
import { IoClose } from 'react-icons/io5';
import { clsx } from 'clsx';
import CustomLabel from './CustomLabel';

const CustomModal = ({ 
    isOpen, 
    onClose, 
    title, 
    children, 
    childenClasses = '',
    size, 
    showCloseButton,
    hasRequiredFields = false,
    footer
}) => {
  
    // Close on Escape key
    useEffect(() => {
        const handleEsc = (e) => { 
            if (e.key === 'Escape') {
                onClose(); 
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
        }

        return () => {
            window.removeEventListener('keydown', handleEsc);
        };
    }, [onClose, isOpen]);

    const sizes = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
        full: 'max-w-[95vw]'
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />

                    {/* Modal Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 40 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 40 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className={clsx(
                            "relative w-full bg-white rounded-[2rem] shadow-2xl border border-gray-100/50 flex flex-col overflow-visible",
                            sizes[size]
                        )}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gray-50/20 flex-shrink-0">
                            <CustomLabel
                                variant='h3' 
                                children={title}
                                addedClass='text-xl text-slate-800 tracking-tight font-bold item-left' 
                                descriptionClass={hasRequiredFields && 'subtitle text-[10px] italic opacity-90'}
                                description={hasRequiredFields && <span>All fields with an asterisk (<span className='text-red-600'>*</span>) are required.</span>}
                            />
                            
                            {showCloseButton && (
                                <button 
                                    onClick={onClose}
                                    className="p-2 hover:bg-white hover:cursor-pointer rounded-full text-slate-400 hover:text-red-600 transition-all active:scale-90"
                                >
                                    <IoClose size={24} />
                                </button>
                            )}
                        </div>

                        {/* Content Area */}
                        {/* 🎯 Changed: Swap overflow-y-auto to dynamic overflow-y-visible. 
                            We also add padding bottom (pb-24) to give the absolute list menu space to render inside the viewport. */}
                        <div className={clsx(
                            "py-4 pb-2 px-6 overflow-y-visible overflow-x-visible flex-1 max-h-[70vh]",
                            childenClasses
                        )}>
                            {children}
                        </div>

                        {/* Optional Footer Container */}
                        {footer && (
                            <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end gap-3 flex-shrink-0 z-10">
                                {footer}
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

// --- PROPTYPES DEFINITION ---
CustomModal.propTypes = {
    /** Boolean to trigger the modal visibility */
    isOpen: PropTypes.bool.isRequired,

    /** Function to handle closing the modal (state update in parent) */
    onClose: PropTypes.func.isRequired,

    /** The text displayed in the gray header area */
    title: PropTypes.string,

    /** The content inside the modal (Form, Text, etc.) */
    children: PropTypes.node.isRequired,

    /** The class for childern container */
    childenClasses: PropTypes.string,

    /** Predefined width sizes */
    size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl', 'full']),

    /** Whether to show the 'X' button in the top right */
    showCloseButton: PropTypes.bool,
    hasRequiredFields: PropTypes.bool,
    footer: PropTypes.node
};

export default CustomModal;