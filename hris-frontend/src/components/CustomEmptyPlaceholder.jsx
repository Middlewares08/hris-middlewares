import { FolderSearch, Plus } from 'lucide-react';
import PropTypes from 'prop-types';
import { toast } from 'sonner';

function CustomEmptyPlaceholder({
    title,
    description,
    searchTerm,
    buttonLabel = "Add New",
    onAction,
    hasButton = true,
    icon: CustomIcon,
}) {
    // Determine dynamic text based on lookups
    const displayTitle = searchTerm 
        ? "No results found" 
        : title || "No records found";

    const displayDescription = searchTerm
        ? `We couldn't find anything matching "${searchTerm}". Try checking your spelling or using a different keyword.`
        : description || "There are currently no items in this section. Start by creating a new record.";

    return (
        <div className="flex flex-col @md:flex-row items-center justify-center p-6 @md:p-10 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50 gap-4 @md:gap-6 w-full transition-all">
            
            {/* ICON STACK - Responsive scaling via parent container breakpoints */}
            <div className="relative shrink-0">
                <div className="w-14 h-14 @md:w-20 @md:h-20 bg-gray-50 rounded-full flex items-center justify-center transition-all">
                    {CustomIcon ? (
                        <CustomIcon className="w-7 h-7 @md:w-10 @md:h-10 text-gray-500/60" />
                    ) : (
                        <FolderSearch className="w-7 h-7 @md:w-10 @md:h-10 text-gray-500/60" />
                    )}
                </div>
                {hasButton && (
                    <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow-xs border border-slate-100">
                        <div className="bg-gray-500 rounded-full p-1">
                            <Plus size={10} className="text-white @md:w-3 @md:h-3" />
                        </div>
                    </div>
                )}
            </div>

            {/* TEXT CONTENT - Text aligns center on mobile/small boxes, left-aligned on wide containers */}
            <div className="text-center @md:text-left max-w-sm flex-1">
                <h3 className="text-sm @md:text-lg font-bold text-slate-700 transition-all">
                    {displayTitle}
                </h3>
                <p className="text-xs @md:text-sm text-slate-400 mt-1 leading-relaxed transition-all">
                    {displayDescription}
                </p>
            </div>

            {/* ACTION BUTTON - Automatically adjusts alignment and margins depending on container size */}
            {hasButton && (
                <button
                    type="button"
                    onClick={onAction || (() => toast.warning("Action handler not implemented."))}
                    className="mt-2 @md:mt-0 flex items-center gap-2 px-4 py-2 @md:px-6 @md:py-2.5 bg-gray-500 hover:bg-gray-600 active:scale-95 text-white text-xs @md:text-sm font-semibold rounded-xl shadow-md shadow-gray-100 transition-all cursor-pointer shrink-0"
                >
                    <Plus className="w-4 h-4" />
                    {buttonLabel}
                </button>
            )}
           
        </div>
    );
}

CustomEmptyPlaceholder.propTypes = {
    /** Override main title text string */
    title: PropTypes.string,
    /** Override descriptive paragraph body text string */
    description: PropTypes.string,
    /** Active user input search query string to trigger standard filtering views */
    searchTerm: PropTypes.string,
    /** Custom text inside the actionable CTA element button */
    buttonLabel: PropTypes.string,
    /** Interactive function trigger mapped down into the button onClick event */
    onAction: PropTypes.func,
    /** Flag to show or totally strip out the action button elements */
    hasButton: PropTypes.bool,
    /** Pass an alternative Lucide icon module reference directly down */
    icon: PropTypes.elementType
};

export default CustomEmptyPlaceholder;