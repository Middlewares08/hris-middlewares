import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, AlertCircle } from 'lucide-react';

const CustomDropdown = ({
    label,
    options = [],
    value,
    onChange,
    renderProps = 'name',  
    returnProps = 'id',    
    isRequired = false,
    disabled = false,
    error = false,
    errorLabel = '',
    icon: StartIcon,       
    iconPosition = 'start', 
    placeholder = 'Select an option',
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false); 
    const [coords, setCoords] = useState(null); 
    const [placement, setPlacement] = useState('bottom'); 
    
    const dropdownRef = useRef(null); 
    const triggerRef = useRef(null);  
    const listRef = useRef(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const updateCoords = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const dropdownHeight = 250; 
            const spaceBelow = window.innerHeight - rect.bottom;

            if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
                setPlacement('top');
                setCoords({
                    bottom: window.innerHeight - rect.top, 
                    left: rect.left,
                    width: rect.width
                });
            } else {
                setPlacement('bottom');
                setCoords({
                    top: rect.bottom, 
                    left: rect.left,
                    width: rect.width
                });
            }
        }
    };

    useEffect(() => {
        if (isOpen) {
            updateCoords();
            window.addEventListener('resize', updateCoords);
            window.addEventListener('scroll', updateCoords, true);
        } else {
            setCoords(null);
        }
        return () => {
            window.removeEventListener('resize', updateCoords);
            window.removeEventListener('scroll', updateCoords, true);
        };
    }, [isOpen]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                dropdownRef.current && 
                !dropdownRef.current.contains(event.target) &&
                listRef.current &&
                !listRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = Array.isArray(options) ? options.find(opt => opt[returnProps] === value) : null;
    const displayValue = selectedOption ? selectedOption[renderProps] : placeholder;

    const handleSelect = (option) => {
        if (disabled) return;
        onChange(option[returnProps]);
        setIsOpen(false);
    };

    const hasOptions = Array.isArray(options) && options.length > 0;

    return (
        <div ref={dropdownRef} className={`w-full flex flex-col gap-1.5 ${className}`}>
            {/* Label Row */}
            {label && (
                <label className={`text-xs font-medium ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
                    {label}
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            {/* Dropdown Button Container */}
            <div ref={triggerRef} className="relative w-full">
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setIsOpen(!isOpen)}
                    className={`
                        w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg border transition-all duration-200 outline-none
                        ${disabled 
                            ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' 
                            : error 
                                ? 'bg-white border-red-500 text-gray-900 focus:border-red-500 focus:ring-1 focus:ring-red-500' 
                                : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400 focus:border-gray-500 focus:ring-1 focus:ring-gray-500'
                        }
                    `}
                >
                    <div className="flex items-center gap-2 scrollbar-y-visible overflow-y-auto w-full">
                        {StartIcon && iconPosition === 'start' && (
                            <StartIcon className={`w-4 h-4 flex-shrink-0 ${error ? 'text-red-500' : 'text-gray-400'}`} />
                        )}

                        <span className={`truncate ${!selectedOption && 'text-gray-400'}`}>
                            {displayValue}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        {StartIcon && iconPosition === 'end' && (
                            <StartIcon className={`w-4 h-4 ${error ? 'text-red-500' : 'text-gray-400'}`} />
                        )}
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />
                    </div>
                </button>

                {/* React Portal: Popover calendar container with responsive position styles */}
                {isOpen && !disabled && mounted && coords && createPortal(
                    <ul 
                        ref={listRef}
                        style={{
                            position: 'fixed', 
                            left: `${coords.left}px`,
                            width: `${coords.width}px`,
                            // 🎯 Fix: Clear previous layout bounds with auto values to prevent stretch/high-offset bugs
                            ...(placement === 'top' 
                                ? { bottom: `${coords.bottom}px`, top: 'auto', marginBottom: '4px' } 
                                : { top: `${coords.top}px`, bottom: 'auto', marginTop: '4px' }
                            )
                        }}
                        className="text-left z-[999999] max-h-60 scrollbar-y-visible overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-2xl py-1 outline-none animate-in fade-in duration-100"
                    >
                        {!hasOptions ? (
                            <li className="px-4 py-3 text-sm text-gray-400 italic text-center bg-gray-50/50">
                                No options found
                            </li>
                        ) : (
                            options.map((option, index) => {
                                const isSelected = option[returnProps] === value;
                                return (
                                    <li
                                        key={option[returnProps] || index}
                                        onClick={() => handleSelect(option)}
                                        className={`
                                            px-3 py-2 text-sm cursor-pointer transition-colors truncate
                                            ${isSelected 
                                                ? 'bg-blue-50 text-blue-600 font-semibold' 
                                                : 'text-gray-700 hover:bg-gray-50'
                                            }
                                        `}
                                    >
                                        {option[renderProps]}
                                    </li>
                                );
                            })
                        )}
                    </ul>,
                    document.body
                )}
            </div>

            {/* Error Segment */}
            {error && errorLabel && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 mt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{errorLabel}</span>
                </div>
            )}
        </div>
    );
};

export default CustomDropdown;