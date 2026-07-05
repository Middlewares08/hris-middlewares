import { useState } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown, ChevronUp } from 'lucide-react';
import CustomLabel from './CustomLabel';

export default function CustomAccordion(props) {
    const [isOpen, setIsOpen] = useState(props?.initialOpen);

    return (
        <div className="w-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-4 transition-all duration-200 hover:shadow-md">
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between p-4 bg-slate-50/50 cursor-pointer select-none border-b border-slate-100"
            >
                <div className="flex items-center space-x-3">
                    {props?.icon && (
                        <div className="p-2 rounded-lg flex items-center justify-center">
                            { props?.icon }
                        </div>
                    )}
                
                    <div>
                        <div className="flex items-center space-x-2">
                            <CustomLabel
                                children={props?.title}
                                variant='h3'
                                addedClass="font-semibold text-slate-800 text-base"
                            />
                            {props?.badgeText && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-800">
                                    {props?.badgeText}
                                </span>
                            )}
                        </div>
                        {props?.description && <p className="text-xs text-slate-500 mt-0.5">{props?.description}</p>}
                    </div>
                </div>

                {/* Right Controls Aligned Row */}
                <div className="flex items-center space-x-4">
                    { props?.sideLabel && (
                        <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                            {props?.sideLabel}
                        </span>
                    )}
                    
                    { isOpen ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                </div>
            </div>

            { isOpen && (
                <div className="p-5 bg-white">
                    {props?.children}
                </div>
            )}
        </div>
    );
}

CustomAccordion.propTypes = {
    icon: PropTypes.elementType,                
    title: PropTypes.string.isRequired,         
    description: PropTypes.string,           
    badgeText: PropTypes.string,                
    sideLabel: PropTypes.node,                  
    initialOpen: PropTypes.bool,                
    children: PropTypes.node.isRequired         
};

CustomAccordion.defaultProps = {
    icon: null,
    description: '',
    badgeText: null,
    sideLabel: null,
    initialOpen: true
};