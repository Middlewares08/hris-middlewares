import { AlertCircle } from 'lucide-react';

const CustomRadioGroup = ({
    label,
    name,               // Unique name for the radio group inputs
    options = [],       // e.g., [{ id: 'hr', label: 'per Hour' }]
    value,
    onChange,
    isRequired = false,
    disabled = false,
    error = false,
    errorLabel = '',
    className = ''
}) => {
    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            {/* Label */}
            {label && (
                <span className={`text-left text-sm font-medium ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
                    {label}
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                </span>
            )}

            {/* Radio Options Flex Row/Col */}
            <div className="flex gap-4 items-center">
                {options.map((option) => {
                    const isSelected = option?.value === value;
                    return (
                        <label
                            key={option?.id}
                            className={`
                                flex items-center gap-2.5 cursor-pointer text-sm select-none
                                ${disabled ? 'cursor-not-allowed opacity-50' : ''}
                            `}
                        >
                            <input
                                type="radio"
                                id={option?.id}
                                name={name}
                                value={option?.value}
                                checked={isSelected}
                                disabled={disabled}
                                onChange={() => !disabled && onChange(option?.value)}
                                className="sr-only" // Hide native browser styles to use custom tailwind design
                            />
                            
                            {/* Custom Styled Circle */}
                            <div className={`
                                w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-150
                                ${disabled 
                                    ? 'border-gray-200 bg-gray-50' 
                                    : error 
                                        ? 'border-red-500 bg-white' 
                                        : isSelected 
                                            ? 'border-gray-600 bg-white' 
                                            : 'border-gray-300 bg-white hover:border-gray-400'
                                }
                            `}>
                                {/* Inner selected bullet */}
                                {isSelected && (
                                    <div className={`w-2.5 h-2.5 rounded-full ${disabled ? 'bg-gray-400' : 'bg-gray-600'}`} />
                                )}
                            </div>

                            <span className={disabled ? 'text-gray-400' : 'text-gray-800'}>
                                {option.label}
                            </span>
                        </label>
                    );
                })}
            </div>

            {/* Error Message */}
            {error && errorLabel && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 mt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{errorLabel}</span>
                </div>
            )}
        </div>
    );
};

export default CustomRadioGroup;