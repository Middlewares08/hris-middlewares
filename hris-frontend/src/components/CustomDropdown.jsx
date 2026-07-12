import { useState, useRef, useEffect } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';

const CustomDropdown = ({
    label,
    options = [],
    value,
    onChange,
    renderProps = 'name',  // The key to display in the UI list
    returnProps = 'id',    // The key to return when selected
    isRequired = false,
    disabled = false,
    error = false,
    errorLabel = '',
    icon: StartIcon,       // Optional: Pass an icon component from lucide-react
    iconPosition = 'start', // 'start' | 'end'
    placeholder = 'Select an option',
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Find the currently selected option to show its text label
    const selectedOption = options.find(opt => opt[returnProps] === value);
    const displayValue = selectedOption ? selectedOption[renderProps] : placeholder;

    const handleSelect = (option) => {
        if (disabled) return;
        onChange(option[returnProps]);
        setIsOpen(false);
    };

    return (
        <div ref={dropdownRef} className={`w-full flex flex-col gap-1.5 ${className}`}>
            {/* Label Row */}
            {label && (
                <label className={`text-sm font-medium ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
                    {label}
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            {/* Dropdown Container */}
            <div className="relative w-full">
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
                                : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                        }
                    `}
                >
                    {/* Inner Content Placement Layout */}
                    <div className="flex items-center gap-2 overflow-hidden w-full">
                        {/* Start Icon Vector */}
                        {StartIcon && iconPosition === 'start' && (
                            <StartIcon className={`w-4 h-4 flex-shrink-0 ${error ? 'text-red-500' : 'text-gray-400'}`} />
                        )}

                        <span className={`truncate ${!selectedOption && 'text-gray-400'}`}>
                            {displayValue}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* End Icon Vector */}
                        {StartIcon && iconPosition === 'end' && (
                            <StartIcon className={`w-4 h-4 ${error ? 'text-red-500' : 'text-gray-400'}`} />
                        )}
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />
                    </div>
                </button>

                {/* Options Menu Popover Panel */}
                {isOpen && !disabled && (
                    <ul className="text-left absolute z-50 w-full mt-1 max-h-60 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1 outline-none">
                        {options.length === 0 ? (
                            <li className="px-3 py-2 text-sm text-gray-400 italic text-center">No options available</li>
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
                                                ? 'bg-indigo-50 text-indigo-600 font-medium' 
                                                : 'text-gray-700 hover:bg-gray-50'
                                            }
                                        `}
                                    >
                                        {option[renderProps]}
                                    </li>
                                );
                            })
                        )}
                    </ul>
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