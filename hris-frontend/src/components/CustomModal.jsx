'use client';
import { useEffect } from 'react';
import PropTypes from 'prop-types'; // Import PropTypes
import { motion, AnimatePresence } from 'framer-motion';
import { IoClose } from 'react-icons/io5';
import { clsx } from 'clsx';

const CustomModal = ({ 
    isOpen, 
    onClose, 
    title, 
    children, 
    childenClasses = '',
    size, 
    showCloseButton 
}) => {
  
    // Close on Escape key
    useEffect(() => {
        const handleEsc = (e) => { 
            if (e.key === 'Escape') {
                onClose(); 
            }
        };

        // Only add the listener if the modal is actually open
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
                            "relative w-full bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-teal-100/50",
                            sizes[size]
                        )}
                    >
                        {/* Header */}
                        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-teal-50/20">
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">
                                {title}
                            </h3>
                            {showCloseButton && (
                                <button 
                                    onClick={onClose}
                                    className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-teal-600 transition-all active:scale-90"
                                >
                                    <IoClose size={24} />
                                </button>
                            )}
                        </div>

                        {/* Content */}
                        <div className={`${childenClasses} p-4 overflow-y-auto max-h-[85vh]`}>
                            {children}
                        </div>
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

    /** The text displayed in the teal header area */
    title: PropTypes.string,

    /** The content inside the modal (Form, Text, etc.) */
    children: PropTypes.node.isRequired,

    /** The class for childern container */
    childenClasses: PropTypes.string,

    /** Predefined width sizes */
    size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl', 'full']),

    /** Whether to show the 'X' button in the top right */
    showCloseButton: PropTypes.bool,
};

export default CustomModal;