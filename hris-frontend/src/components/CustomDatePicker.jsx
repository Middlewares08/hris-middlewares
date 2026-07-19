import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, AlertCircle, X } from 'lucide-react';

const CustomDatePicker = ({
    label,
    value, 
    onChange, 
    isRequired = false,
    disabled = false,
    error = false,
    errorLabel = '',
    placeholder = 'Select a date',
    className = '',
    minDate = null, 
    maxDate = null  
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false); 
    const [coords, setCoords] = useState(null); 
    const [placement, setPlacement] = useState('bottom'); 
    
    const containerRef = useRef(null); // Keep for click outside detection
    const triggerRef = useRef(null);   // 🎯 Added: Measures ONLY the input button box
    const calendarRef = useRef(null);

    // Normalize min and max dates to start of day for accurate comparison
    const getNormalizedDate = (dateVal) => {
        if (!dateVal) return null;
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return null;
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    };

    const normalizedMin = getNormalizedDate(minDate);
    const normalizedMax = getNormalizedDate(maxDate);

    useEffect(() => {
        setMounted(true);
    }, []);

    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        if (isOpen && value) {
            setCurrentDate(new Date(value));
        }
    }, [isOpen, value]);

    // 🎯 Smart Viewport Coordinates using triggerRef instead of containerRef
    const updateCoords = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const calendarHeight = 340; 
            const spaceBelow = window.innerHeight - rect.bottom;
            
            if (spaceBelow < calendarHeight && rect.top > calendarHeight) {
                setPlacement('top');
                setCoords({
                    bottom: window.innerHeight - rect.top, 
                    left: rect.left,
                    width: 320 
                });
            } else {
                setPlacement('bottom');
                setCoords({
                    top: rect.bottom, 
                    left: rect.left,
                    width: 320 
                });
            }
        }
    };

    useEffect(() => {
        if (isOpen) {
            updateCoords();
            window.addEventListener('resize', updateCoords);
            window.addEventListener('scroll', updateCoords, true);
        } else {
            setCoords(null);
        }
        return () => {
            window.removeEventListener('resize', updateCoords);
            window.removeEventListener('scroll', updateCoords, true);
        };
    }, [isOpen]);

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                containerRef.current && 
                !containerRef.current.contains(event.target) &&
                calendarRef.current &&
                !calendarRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Calendar Helper Logic
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const daysOfWeek = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const isPrevMonthDisabled = () => {
        if (!normalizedMin) return false;
        const prevMonthLastDay = new Date(year, month, 0);
        return prevMonthLastDay < normalizedMin;
    };

    const isNextMonthDisabled = () => {
        if (!normalizedMax) return false;
        const nextMonthFirstDay = new Date(year, month + 1, 1);
        return nextMonthFirstDay > normalizedMax;
    };

    const handlePrevMonth = () => {
        if (isPrevMonthDisabled()) return;
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
        if (isNextMonthDisabled()) return;
        setCurrentDate(new Date(year, month + 1, 1));
    };

    const handleDateSelect = (day) => {
        if (disabled || isDayDisabled(day)) return;
        const selected = new Date(year, month, day);
        onChange(selected);
        setIsOpen(false);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange(null);
    };

    const formatDateDisplay = (val) => {
        if (!val) return '';
        const d = new Date(val);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const isSelectedDay = (day) => {
        if (!value) return false;
        const d = new Date(value);
        return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    };

    const isDayDisabled = (day) => {
        const targetDate = new Date(year, month, day);
        if (normalizedMin && targetDate < normalizedMin) return true;
        if (normalizedMax && targetDate > normalizedMax) return true;
        return false;
    };

    const renderCalendarDays = () => {
        const slots = [];
        for (let i = 0; i < firstDayOfMonth; i++) {
            slots.push(<div key={`empty-${i}`} className="w-9 h-9" />);
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const active = isSelectedDay(day);
            const isDayLocked = isDayDisabled(day);
            
            slots.push(
                <button
                    key={`day-${day}`}
                    type="button"
                    disabled={isDayLocked}
                    onClick={() => handleDateSelect(day)}
                    className={`w-9 h-9 rounded-full text-xs font-semibold flex items-center justify-center transition-all duration-150
                        ${active 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : isDayLocked 
                                ? 'text-gray-200 cursor-not-allowed bg-transparent font-normal' 
                                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        }
                    `}
                >
                    {day}
                </button>
            );
        }
        return slots;
    };

    return (
        <div ref={containerRef} className={`w-full flex flex-col space-y-1 ${className}`}>
            {/* Label Row */}
            {label && (
                <label className={`text-xs font-medium ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
                    {label}
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            {/* Input Trigger Block */}
            {/* 🎯 Ref placed here to isolate measurements from the label */}
            <div ref={triggerRef} className="relative w-full">
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setIsOpen(!isOpen)}
                    className={`
                        w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg border transition-all duration-200 outline-none text-left
                        ${disabled 
                            ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' 
                            : error 
                                ? 'bg-white border-red-500 text-gray-900 focus:border-red-500 focus:ring-1 focus:ring-red-500' 
                                : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400 focus:border-gray-500 focus:ring-1 focus:ring-gray-500'
                        }
                    `}
                >
                    <div className="flex items-center gap-2 truncate">
                        <Calendar className={`w-4 h-4 flex-shrink-0 ${error ? 'text-red-500' : 'text-gray-400'}`} />
                        <span className={`truncate ${!value && 'text-gray-400'}`}>
                            {value ? formatDateDisplay(value) : placeholder}
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        {value && !disabled && (
                            <span 
                                onClick={handleClear}
                                className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </span>
                        )}
                        <span className="w-px h-4 bg-gray-200 mx-1" />
                        <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'transform rotate-90' : ''}`} />
                    </div>
                </button>

                {/* React Portal: Popover calendar container with responsive position styles */}
                {isOpen && !disabled && mounted && coords && createPortal(
                    <div 
                        ref={calendarRef}
                        style={{
                            position: 'fixed',
                            left: `${coords.left}px`,
                            width: `${coords.width}px`,
                            // 🎯 Fix: Clear opposing positional values with auto to prevent stretching/gaps
                            ...(placement === 'top' 
                                ? { bottom: `${coords.bottom}px`, top: 'auto', marginBottom: '6px' } 
                                : { top: `${coords.top}px`, bottom: 'auto', marginTop: '6px' }
                            )
                        }}
                        className="bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 z-[999999] outline-none select-none animate-in fade-in duration-100"
                    >
                        {/* Calendar Header Controls */}
                        <div className="flex items-center justify-between mb-4">
                            <button 
                                type="button" 
                                onClick={handlePrevMonth}
                                disabled={isPrevMonthDisabled()}
                                className={`p-1.5 rounded-lg transition-colors ${
                                    isPrevMonthDisabled() 
                                        ? 'text-gray-200 cursor-not-allowed' 
                                        : 'hover:bg-gray-100 text-gray-600'
                                }`}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-bold text-gray-800">
                                {months[month]} {year}
                            </span>
                            <button 
                                type="button" 
                                onClick={handleNextMonth}
                                disabled={isNextMonthDisabled()}
                                className={`p-1.5 rounded-lg transition-colors ${
                                    isNextMonthDisabled() 
                                        ? 'text-gray-200 cursor-not-allowed' 
                                        : 'hover:bg-gray-100 text-gray-600'
                                }`}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Week Days Label Row */}
                        <div className="grid grid-cols-7 gap-1 mb-1.5 text-center">
                            {daysOfWeek.map((day) => (
                                <div key={day} className="text-xs font-semibold text-gray-400 w-9 h-6 flex items-center justify-center">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Month Days Grid Canvas */}
                        <div className="grid grid-cols-7 gap-1 text-center justify-items-center">
                            {renderCalendarDays()}
                        </div>
                    </div>,
                    document.body
                )}
            </div>

            {/* Error Message Section */}
            {error && errorLabel && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 mt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{errorLabel}</span>
                </div>
            )}
        </div>
    );
};

export default CustomDatePicker;