import clsx from 'clsx';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';

CustomLabel.propTypes = {
    /** Any: A unique identifier  */
    id: PropTypes.any,

    /** Node: A children component  */
    children: PropTypes.node,

    /** String: A string link  */
    link: PropTypes.string,

    /** One of: text, link, h1, h2, h3, h4, h5, h6, default, subtitle  */
    variant: PropTypes.oneOf(['text', 'link', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'default', 'subtitle']),

    /** String: Additional CSS attribute  */
    addedClass: PropTypes.string,

    /** String: A string description  */
    description: PropTypes.string,

    /** String: A string class for description  */
    descriptionClass: PropTypes.string,

    /** Node: Icon component */
    icon: PropTypes.node,

    /** String: A css attribute for text container  */
    textContainerClass: PropTypes.string,

    /** One Of: right or left */
    iconPosition: PropTypes.oneOf(['right', 'left']),

    /** String: CSS attribute for icon */
    iconClasses: PropTypes.string,
};

function CustomLabel({
    id,
    children,
    link = '#',
    variant,
    addedClass,
    description,
    descriptionClass,
    icon,
    textContainerClass = '',
    iconPosition = 'left',
    iconClasses,
    ...rest // 💡 Gathers native props (like target, onClick) without leaking custom visual flags
}) {

    const renderLabel = () => {
        // Native alternative to !_.isNil(variant) && _.isEqual(variant, 'link')
        if (variant === 'link') {
            return (
                <Link 
                    to={link}
                    className="text-teal-600 hover:text-black font-bold"
                    target='_blank'
                    {...rest} // 💡 Safe spreading here now
                >
                    {children}
                </Link>
            );
        }

        switch (variant) {
            case 'h1':
                return <h1 id={id} className={clsx(addedClass)}>{children}</h1>;
            case 'h2':
                return <h2 id={id} className={clsx(addedClass)}>{children}</h2>;
            case 'h3':
                return <h3 id={id} className={clsx(addedClass)}>{children}</h3>;
            case 'h4':
                return <h4 id={id} className={clsx(addedClass)}>{children}</h4>;
            case 'h5':
                return <h5 id={id} className={clsx(addedClass)}>{children}</h5>;
            case 'h6':
                return <h6 id={id} className={clsx(addedClass)}>{children}</h6>;
            case 'subtitle':
                return <span id={id} className={clsx('subtitle', addedClass)}>{children}</span>;
            default:
                return <span id={id} className={clsx(addedClass)}>{children}</span>;
        }
    };
    
    return (
        <div className={clsx(textContainerClass, 'flex items-start')}>
            {icon && (
                <div className={clsx(
                    iconPosition === 'right' ? 'order-last ml-2' : 'order-first mr-2', 
                    iconClasses
                )}>
                    {icon}
                </div>
            )}
            <div className="flex flex-col text-black w-full items-start text-left">
                {renderLabel()}
                {description && (
                    <span className={clsx('text-gray-400', descriptionClass)}>
                        {description}
                    </span>
                )} 
            </div>
        </div>
    );
}

export default CustomLabel;