import PropTypes from 'prop-types';
import { Link, useLocation } from 'react-router-dom';
import { can } from '../utils/permissionCheck';

const VARIANTS = {
    gray: {
        active: 'border-gray-500 text-gray-600 bg-gray-50/50',
        inactive: 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
    },
    indigo: {
        active: 'border-indigo-500 text-indigo-600 bg-indigo-50/50',
        inactive: 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
    },
    slate: {
        active: 'border-slate-800 text-slate-800 bg-slate-100',
        inactive: 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
    }
};

function CustomTabs(props) {
    const location = useLocation();

    const baseTabStyle = 'flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all border-b-2';
    const variantTokens = VARIANTS[props?.variant] || VARIANTS.gray;
    const containerClass = props?.className || '';

    // 🛡️ Filter tabs line-by-line based on permissions
    const visibleTabs = (props?.tabs || []).filter(
        (tab) => !tab.permission || can(tab.permission)
    );

    return (
        <div className={`flex border-b border-slate-200 ${containerClass}`}>
            {visibleTabs.map((tab) => {
                // Handle matching for exact sub-routes seamlessly
                const isActive = location.pathname === tab.path;
                const TabIcon = tab.icon;

                return (
                    <Link
                        key={tab.path}
                        to={tab.path}
                        className={`${baseTabStyle} ${isActive ? variantTokens.active : variantTokens.inactive}`}
                    >
                        {TabIcon && <TabIcon size={props?.iconSize || 18} />}
                        <span>{tab.label}</span>
                    </Link>
                );
            })}
        </div>
    );
}

CustomTabs.propTypes = {
    variant: PropTypes.oneOf(['gray', 'indigo', 'slate']),
    iconSize: PropTypes.number,
    className: PropTypes.string,
    tabs: PropTypes.arrayOf(
        PropTypes.shape({
            label: PropTypes.string.isRequired,
            path: PropTypes.string.isRequired,
            icon: PropTypes.elementType, // Expects the uninstantiated component token reference (e.g., Tags, Boxes)
            permission: PropTypes.string // 🛡️ Added validation rule for optional permission property
        })
    ).isRequired
};

export default CustomTabs;