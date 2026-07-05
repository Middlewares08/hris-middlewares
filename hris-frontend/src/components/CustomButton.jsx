import PropTypes from 'prop-types';

const VARIANTS = {
    // 💡 Your classes are now configured as the primary (default) theme
    primary: 'bg-slate-900 hover:bg-slate-800 text-white focus:ring-slate-700 disabled:bg-slate-400',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-100 focus:ring-slate-500 shadow-sm disabled:bg-slate-400',
    outline: 'border border-slate-600 hover:bg-slate-800 text-slate-300 focus:ring-slate-500 disabled:bg-slate-800 disabled:opacity-40',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500 shadow-sm disabled:bg-rose-400',
};

const SIZES = {
    sm: 'px-3 py-1.5 text-xs font-medium',
    md: 'w-full py-2.5 text-sm font-semibold', // 💡 Updated default md size to your padding layout
    lg: 'w-full py-3 text-base font-semibold',
};

function CustomButton(props) {
    // 💡 Included cursor-pointer along with smooth transition alignments
    const baseStyle = 'inline-flex items-center justify-center rounded-lg font-sans transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white cursor-pointer disabled:cursor-not-allowed';
    
    const variantStyle = VARIANTS[props?.variant] || VARIANTS.primary;
    const sizeStyle = SIZES[props?.size] || SIZES.md;
    const buttonType = props?.type || 'button';
    const extraClass = props?.className || '';

    const renderIcon = (position) => {
        if (props?.isLoading || !props?.icon || (props?.iconPosition || 'left') !== position) return null;

        const iconSpacing = position === 'left' ? '-ml-0.5 mr-2' : 'ml-2 -mr-0.5';
        const ButtonIcon = props.icon;
        
        return <ButtonIcon className={`h-4 w-4 ${iconSpacing}`} aria-hidden="true" />;
    };

    return (
        <button
            type={buttonType}
            disabled={props?.disabled || props?.isLoading}
            className={`${baseStyle} ${variantStyle} ${sizeStyle} ${extraClass}`}
            {...props}
        >
            {props?.isLoading && (
                <svg className="animate-spin -ml-1 mr-2.5 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
            )}

            {renderIcon('left')}
            <span>{props?.isLoading ? 'Processing...' : props?.children}</span>
            {renderIcon('right')}
        </button>
    );
}

CustomButton.propTypes = {
    children: PropTypes.node.isRequired,
    type: PropTypes.oneOf(['button', 'submit', 'reset']),
    variant: PropTypes.oneOf(['primary', 'secondary', 'outline', 'danger']),
    size: PropTypes.oneOf(['sm', 'md', 'lg']),
    isLoading: PropTypes.bool,
    disabled: PropTypes.bool,
    className: PropTypes.string,
    icon: PropTypes.elementType,
    iconPosition: PropTypes.oneOf(['left', 'right']),
};

export default CustomButton;