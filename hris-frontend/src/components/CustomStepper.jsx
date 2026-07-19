import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion'; // 🎯 Ensure these are imported

// 🎯 Animation variants using the dynamic direction (custom prop)
const slideVariants = {
    enter: (direction) => ({
        x: direction > 0 ? 30 : -30,
        opacity: 0,
    }),
    center: {
        x: 0,
        opacity: 1,
    },
    exit: (direction) => ({
        x: direction < 0 ? 30 : -30,
        opacity: 0,
    }),
};

export function CustomStepper({ steps = [], currentStep = 0, onStepClick }) {
    const containerRef = useRef(null);
    const stepRefs = useRef([]);
    
    // 🎯 Track the previous step to determine the slide direction
    const [prevStep, setPrevStep] = useState(currentStep);

    useEffect(() => {
        setPrevStep(currentStep);
    }, [currentStep]);

    // 1 = next/forward, -1 = prev/backward
    const direction = currentStep >= prevStep ? 1 : -1;

    // Auto-scroll logic to active step
    useEffect(() => {
        const activeElement = stepRefs.current[currentStep];
        const container = containerRef.current;

        if (activeElement && container) {
            const containerWidth = container.offsetWidth;
            const elementOffset = activeElement.offsetLeft;
            const elementWidth = activeElement.offsetWidth;

            container.scrollTo({
                left: elementOffset - containerWidth / 2 + elementWidth / 2,
                behavior: 'smooth',
            });
        }
    }, [currentStep]);

    return (
        <div className="w-full space-y-6">
            {/* Mobile View: Simple Progress Text */}
            <div className="md:hidden flex items-center justify-between px-4 mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Step {currentStep + 1} of {steps.length}
                </span>
                <span className="text-sm font-bold text-green-600">
                    {steps[currentStep]?.title}
                </span>
            </div>

            {/* Desktop View: Horizontal Scrollable Stepper Header */}
            <div 
                ref={containerRef}
                className="hidden md:flex items-center w-full bg-white p-5 rounded-xl border border-gray-100 shadow-xs overflow-x-auto scrollbar-none gap-2 select-none"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {steps.map((step, index) => {
                    const isCompleted = index < currentStep;
                    const isActive = index === currentStep;
                    const isUpcoming = index > currentStep;

                    return (
                        <React.Fragment key={index}>
                            {/* Step Item */}
                            <button
                                ref={(el) => (stepRefs.current[index] = el)}
                                type="button"
                                disabled={isUpcoming || !onStepClick}
                                onClick={() => onStepClick?.(index)}
                                className={`flex items-center gap-3 relative z-10 text-left outline-none transition-all flex-shrink-0 ${
                                    isCompleted && onStepClick ? 'cursor-pointer' : 'cursor-default'
                                }`}
                            >
                                {/* Circle */}
                                <div
                                    className={`flex items-center justify-center w-9 h-9 rounded-full border-2 font-semibold text-xs flex-shrink-0 transition-all duration-300 ${
                                        isCompleted
                                            ? 'bg-green-600 border-green-600 text-white'
                                            : isActive
                                            ? 'bg-white border-orange-600 text-orange-600 shadow-sm shadow-orange-100'
                                            : 'bg-white border-gray-200 text-gray-400'
                                    }`}
                                >
                                    {isCompleted ? (
                                        <Check size={16} className="stroke-3" />
                                    ) : (
                                        <span>{index + 1}</span>
                                    )}
                                </div>

                                {/* Labels */}
                                <div className="flex flex-col pr-2 flex-shrink-0">
                                    <span
                                        className={`text-sm font-bold transition-colors duration-300 ${
                                            isActive ? 'text-orange-600' : isCompleted ? 'text-gray-900' : 'text-gray-400'
                                        }`}
                                    >
                                        {step?.title}
                                    </span>
                                    {step?.description && (
                                        <span className="text-xs text-gray-400 font-medium tracking-wide mt-0.5">
                                            {step?.description}
                                        </span>
                                    )}
                                </div>
                            </button>

                            {/* Connecting Line */}
                            {index < steps.length - 1 && (
                                <div className="flex-1 min-w-[60px] h-1.5 mx-4 bg-gray-100 rounded-full relative overflow-visible flex-shrink-0">
                                    <div
                                        className="absolute top-0 left-0 h-full bg-green-600 transition-all duration-500 ease-in-out rounded-l-full"
                                        style={{ width: isCompleted ? '100%' : '0%' }}
                                    >
                                        {isCompleted && (
                                            <div 
                                                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full"
                                                style={{
                                                    width: 0,
                                                    height: 0,
                                                    borderTop: '6px solid transparent',
                                                    borderBottom: '6px solid transparent',
                                                    borderLeft: '10px solid #16a34a',
                                                }}
                                            />
                                        )}
                                    </div>
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* 🎯 Content Container: Animated with slide direction */}
            <div className="w-full bg-white rounded min-h-[300px] scrollbar-y-visible overflow-y-auto max-h-[70vh]">
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={currentStep}
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        // 🎯 Force clean layout bounds after animation finishes
                        style={{ transform: 'none' }} 
                    >
                        {steps[currentStep]?.content}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}