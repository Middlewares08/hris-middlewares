import PropTypes from 'prop-types';
import { Check, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

const CustomSelection = ({
    type = 'checkbox',
    label,
    sublabel,
    checked,
    onChange,
    name,
    value,
    disabled = false,
    isRequired = false,
    error = false,
    errorLabel = '',
    className,
    indicatorPosition = 'right',
}) => {
    const isRadio = type === 'radio';
    const indicatorFirst = indicatorPosition === 'left';

    const indicator = (
        <span
            className={clsx(
                'flex h-5 w-5 shrink-0 items-center justify-center border transition-all duration-200',
                isRadio ? 'rounded-full' : 'rounded-md',
                checked && !disabled && 'border-blue-500 bg-blue-500 text-white',
                checked && disabled && 'border-gray-300 bg-gray-300 text-white',
                !checked && 'border-gray-300 bg-white',
            )}
        >
            {isRadio
                ? checked && <span className="h-2 w-2 rounded-full bg-current" />
                : checked && <Check className="h-3.5 w-3.5 stroke-3" />}
        </span>
    );

    return (
        <div className={clsx('w-full', className)}>
            <label
                className={clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200',
                    indicatorFirst ? 'justify-start' : 'justify-between',
                    disabled
                        ? 'border border-gray-200 bg-gray-100 cursor-not-allowed'
                        : 'cursor-pointer',
                    !disabled && error && 'border border-rose-400 bg-rose-50/50',
                    !disabled && !error && !checked && ' hover:border-gray-400',
                )}
            >
                {/* Hidden native input keeps keyboard + form semantics */}
                <input
                    type={type}
                    name={name}
                    value={value}
                    checked={checked}
                    disabled={disabled}
                    required={isRequired}
                    onChange={(e) => onChange(isRadio ? true : e.target.checked)}
                    className="sr-only"
                />

                {indicatorFirst && indicator}

                <div className="flex flex-col">
                    <span className={clsx('font-medium', disabled ? 'text-gray-400' : 'text-slate-700')}>
                        {label}
                        {isRequired && <span className="ml-1 font-bold text-rose-500" aria-hidden="true">*</span>}
                    </span>
                    {sublabel && <span className="mt-0.5 text-xs text-gray-400">{sublabel}</span>}
                </div>

                {!indicatorFirst && indicator}
            </label>

            {error && errorLabel && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-rose-600">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{errorLabel}</span>
                </div>
            )}
        </div>
    );
};

CustomSelection.propTypes = {
    /** Control style: 'checkbox' or 'radio' */
    type: PropTypes.oneOf(['checkbox', 'radio']),

    /** Primary label text */
    label: PropTypes.string.isRequired,

    /** Optional secondary label rendered below the main label */
    sublabel: PropTypes.string,

    /** Checked state (for radio, pass selectedValue === value) */
    checked: PropTypes.bool.isRequired,

    /** Change handler; receives the next checked boolean */
    onChange: PropTypes.func.isRequired,

    /** Native input name */
    name: PropTypes.string,

    /** Native input value (used for radio groups) */
    value: PropTypes.string,

    /** Disables interaction */
    disabled: PropTypes.bool,

    /** Renders a required asterisk beside the label */
    isRequired: PropTypes.bool,

    /** Error state styling */
    error: PropTypes.bool,

    /** Message shown below the control when error is true */
    errorLabel: PropTypes.string,

    /** Wrapper class */
    className: PropTypes.string,

    /** Which side the checkbox/radio indicator sits on */
    indicatorPosition: PropTypes.oneOf(['left', 'right']),
};

export default CustomSelection;
