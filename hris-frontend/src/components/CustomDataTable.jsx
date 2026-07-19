import { useState, useEffect } from 'react';
import { Search, Filter, ChevronRight, ChevronLeft, X, PackageSearch } from 'lucide-react';
import CustomEmptyPlaceholder from './CustomEmptyPlaceholder';
import { motion, AnimatePresence } from 'framer-motion';
import { useDebounce } from 'use-debounce'; // 🎯 Added import

/**
 * CustomDataTable - Supports built-in or server-side pagination and loading states
 */
export function CustomDataTable({ 
    data = [], 
    columns = [], 
    isLoading = false,
    onSearch, 
    searchPlaceholder = "Search...",
    filterContent,
    actionButton,
    renderDrawerContent,
    // Optional Server-side Pagination Props
    isServerSide = false,
    totalRecords = 0,
    currentPage = 1,
    recordsPerPage = 10,
    onPageChange
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRow, setSelectedRow] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [localPage, setLocalPage] = useState(1);
    const [localLimit] = useState(10); // Default local page size

    // 🎯 1. Place the debounce hook safely at the top level of the component body
    const [debouncedSearchTerm] = useDebounce(searchTerm, 500);

    // 🎯 2. Use an effect to watch the debounced output and trigger the search callback
    useEffect(() => {
        if (onSearch) {
            onSearch(debouncedSearchTerm);
        }
    }, [debouncedSearchTerm, onSearch]);

    // 🎯 3. Light event handler that only resets page state and updates input text instantly
    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        if (isServerSide && onPageChange) {
            onPageChange(1); // Reset server-side page to 1 on type search
        } else {
            setLocalPage(1); // Reset client-side local page to 1 on type search
        }
    };

    // Process client-side search data if not controlled by server
    const filteredData = onSearch 
        ? data 
        : data.filter(item => 
            Object.values(item).some(val => 
                String(val).toLowerCase().includes(searchTerm.toLowerCase())
            )
        );

    // Compute Pagination State Parameters
    const activePage = isServerSide ? currentPage : localPage;
    const limit = isServerSide ? recordsPerPage : localLimit;
    const total = isServerSide ? totalRecords : filteredData.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Slice data array locally if client-side paginated
    const paginatedData = isServerSide 
        ? filteredData 
        : filteredData.slice((activePage - 1) * limit, activePage * limit);

    const handlePageClick = (newPage) => {
        if (newPage < 1 || newPage > totalPages) return;
        if (isServerSide && onPageChange) {
            onPageChange(newPage);
        } else {
            setLocalPage(newPage);
        }
    };

    return (
        <div className="space-y-4 w-full">
            {/* Control Action Bar */}
            <div className="flex w-full justify-between flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex flex-1 items-center gap-2 max-w-md bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 focus-within:border-slate-400 transition-colors">
                    <Search size={18} className="text-gray-400" />
                    <input 
                        type="text" 
                        value={searchTerm}
                        onChange={handleSearchChange}
                        placeholder={searchPlaceholder} 
                        className="bg-transparent outline-none w-full text-sm text-gray-800" 
                    />
                </div>
                
                <div className="flex items-center gap-3 self-end md:self-auto">
                    {filterContent && (
                        <button 
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters ? 'bg-slate-50 border-slate-400 text-slate-800' : 'text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                        >
                            <Filter size={16} /> Filters
                        </button>
                    )}
                    {actionButton}
                </div>
            </div>

            {/* Filters Panel Area */}
            {showFilters && filterContent && (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 animate-fadeIn">
                    {filterContent}
                </div>
            )}

            {/* Main Data Structure Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
                <div className="scrollbar-x-visible overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                                {columns.map((col, index) => (
                                    <th key={index} className={`p-4 font-semibold ${col.className || ''}`}>
                                        {col.header}
                                    </th>
                                ))}
                                {renderDrawerContent && <th className="w-12"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                            {isLoading ? (
                                Array.from({ length: limit }).map((_, rowIndex) => (
                                    <tr key={rowIndex} className="animate-pulse">
                                        {columns.map((_, colIndex) => (
                                            <td key={colIndex} className="p-4">
                                                <div className="h-4 bg-gray-200 rounded-md w-3/4 my-1"></div>
                                            </td>
                                        ))}
                                        {renderDrawerContent && <td className="p-4"><div className="h-4 bg-gray-200 rounded-md w-4 ml-auto"></div></td>}
                                    </tr>
                                ))
                            ) : paginatedData.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length + 1} className="p-8 text-center text-gray-400">
                                        <CustomEmptyPlaceholder
                                            title="No data found."
                                            description="No record loaded from the server."
                                            icon={PackageSearch}
                                            hasButton={false}
                                        />
                                    </td>
                                </tr>
                            ) : (
                                paginatedData.map((row, rowIndex) => (
                                    <tr 
                                        key={row.id || rowIndex}
                                        onClick={() => renderDrawerContent && setSelectedRow(row)}
                                        className={`transition-colors ${renderDrawerContent ? 'hover:bg-slate-50/80 cursor-pointer' : ''}`}
                                    >
                                        {columns.map((col, colIndex) => (
                                            <td key={colIndex} className={`p-4 ${col.className || ''}`} onClick={(e) => col.stopClickPropagation && e.stopPropagation()}>
                                                {col.render ? col.render(row) : row[col.accessor]}
                                            </td>
                                        ))}
                                        {renderDrawerContent && (
                                            <td className="p-4 text-right text-gray-400 pr-6">
                                                <ChevronRight size={18} />
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PAGINATION CONTROL FOOTER */}
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 select-none">
                    <div className="flex-1 flex justify-between sm:hidden">
                        <button
                            onClick={() => handlePageClick(activePage - 1)}
                            disabled={activePage === 1 || isLoading}
                            className="relative inline-flex items-center px-4 py-2 border border-gray-200 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => handlePageClick(activePage + 1)}
                            disabled={activePage === totalPages || isLoading}
                            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-200 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-gray-500">
                                Showing{' '}
                                <span className="font-medium">
                                    {total === 0 ? 0 : (activePage - 1) * limit + 1}
                                </span>{' '}
                                to{' '}
                                <span className="font-medium">
                                    {Math.min(activePage * limit, total)}
                                </span>{' '}
                                of <span className="font-medium">{total}</span> results
                            </p>
                        </div>
                        <div>
                            <nav className="relative z-0 inline-flex rounded-md shadow-xs -space-x-px" aria-label="Pagination">
                                <button
                                    onClick={() => handlePageClick(activePage - 1)}
                                    disabled={activePage === 1 || isLoading}
                                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-200 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                
                                <span className="relative inline-flex items-center px-4 py-2 border border-gray-200 bg-gray-50 text-sm font-medium text-gray-700">
                                    Page {activePage} of {totalPages}
                                </span>

                                <button
                                    onClick={() => handlePageClick(activePage + 1)}
                                    disabled={activePage === totalPages || isLoading}
                                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-200 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </nav>
                        </div>
                    </div>
                </div>
            </div>
            
            <AnimatePresence>
                {selectedRow && renderDrawerContent && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[100] flex justify-end" 
                        onClick={() => setSelectedRow(null)}
                    >
                        <motion.div 
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="w-full max-w-md bg-white h-full shadow-2xl p-6 flex flex-col relative" 
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                                <h3 className="font-bold text-lg text-gray-900">Details View</h3>
                                <button 
                                    onClick={() => setSelectedRow(null)} 
                                    className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="py-4 flex-1 overflow-y-auto">
                                {renderDrawerContent(selectedRow, () => setSelectedRow(null))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}