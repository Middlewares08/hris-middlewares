import { forwardRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';

const VARIANTS = {
    primary: 'border-gray-300 bg-gray-50 focus-within:ring-blue-500 focus-within:border-blue-500',
    error: 'border-rose-400 bg-rose-50/50 focus-within:ring-rose-500 focus-within:border-rose-500',
    disabled: 'border-gray-200 bg-gray-100 cursor-not-allowed'
};

const CustomInput = forwardRef(({
    label,
    type = 'text',
    variant = 'primary',
    disabled = false,
    error = false,
    errorLabel,
    isRequired = false,
    icon: InputIcon,
    iconSize = 16,
    iconPosition = 'left',
    labelPosition = 'left',
    className,
    inputClassName,
    labelClassName,
    maxLength,
    minLength,
    showCharacterCount,
    value,
    ...rest // 💡 Contains ONLY valid HTML attributes like value, onChange, placeholder, etc.
}, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    
    const isPasswordType = type === 'password';
    const currentLength = value ? value.replace(/\s/g, '').length : 0;

    let variantStyle = VARIANTS[variant] || VARIANTS.primary;
    if (disabled) {
        variantStyle = VARIANTS.disabled;
    } else if (error) {
        variantStyle = VARIANTS.error;
    }

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    const renderIcon = (position) => {
        if (!InputIcon || iconPosition !== position) return null;

        return (
            <InputIcon 
                size={iconSize} 
                className={clsx(
                    'shrink-0 text-gray-400',
                    error && 'text-rose-400',
                    disabled && 'opacity-50'
                )} 
            />
        );
    };

    return (
        <div className={clsx('space-y-1 w-full', className)}>
            {/* Input Label */}
            {label && (
                <label className={clsx(
                    error && 'text-rose-400!',
                    'block text-sm font-medium text-slate-700 w-full',
                    labelPosition === 'left' && 'text-left',
                    labelPosition === 'middle' && 'text-center',
                    labelPosition === 'right' && 'text-right',
                    labelClassName
                )}>
                    {label}
                    {isRequired && (
                        <span className="text-rose-500 ml-1 font-bold" aria-hidden="true">
                            *
                        </span>
                    )}
                </label>
            )}

            {/* Input Frame Container Box */}
            <div className={clsx(
                'flex items-center gap-2 rounded-lg border px-3 py-2 transition-all duration-200 focus-within:ring-2', 
                variantStyle
            )}>
                {renderIcon('left')}

                <input
                    ref={ref}
                    type={isPasswordType && showPassword ? 'text' : type}
                    disabled={disabled}
                    required={isRequired}
                    minLength={minLength}
                    maxLength={maxLength}
                    value={value}
                    className={clsx(
                        'w-full bg-transparent outline-none text-sm text-gray-700 placeholder-gray-400 disabled:cursor-not-allowed', 
                        inputClassName
                    )}
                    {...rest} // 💡 Safely spread only clean standard attributes here now!
                />

                {renderIcon('right')}

                {isPasswordType && !disabled && (
                    <button
                        type="button"
                        onClick={togglePasswordVisibility}
                        className="text-gray-400 hover:text-gray-600 focus:outline-none shrink-0 cursor-pointer ml-1"
                        tabIndex={-1}
                    >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                )}
            </div>

            {(error || showCharacterCount) && (
                <div className="flex justify-between items-start w-full">
                    <div className="flex-1">
                        <p className="text-xs font-medium text-rose-500 mt-1 text-left">
                            {errorLabel}
                        </p>
                    </div>
                    { showCharacterCount && (
                        <div className={clsx(
                            'text-xs ml-2 whitespace-nowrap', 
                            // Turn text red if they somehow exceed max length (useful for soft limits)
                            maxLength && currentLength >= maxLength ? 'text-red-500' : 'text-gray-500'
                        )}>
                            {currentLength} {maxLength ? `/ ${maxLength}` : ''}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

CustomInput.displayName = 'CustomInput';

CustomInput.propTypes = {
    label: PropTypes.string,
    type: PropTypes.string,
    variant: PropTypes.oneOf(['primary', 'error', 'disabled']),
    disabled: PropTypes.bool,
    error: PropTypes.bool,         
    errorLabel: PropTypes.string,  
    isRequired: PropTypes.bool,    
    icon: PropTypes.elementType,
    iconSize: PropTypes.number,
    iconPosition: PropTypes.oneOf(['left', 'right']),
    labelPosition: PropTypes.oneOf(['left', 'middle', 'right']), 
    className: PropTypes.string,      
    inputClassName: PropTypes.string, 
    labelClassName: PropTypes.string, 
    minLength: PropTypes.number,
    maxLength: PropTypes.number,
};

export default CustomInput;