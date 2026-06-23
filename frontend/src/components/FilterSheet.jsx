import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, SlidersHorizontal } from 'lucide-react';

const PRICE_BRACKETS = [
  { label: 'Under 10k',    min: null,   max: 10000  },
  { label: 'Under 20k',    min: null,   max: 20000  },
  { label: '20k – 50k',   min: 20000,  max: 50000  },
  { label: '50k – 100k',  min: 50000,  max: 100000 },
  { label: '100k – 200k', min: 100000, max: 200000 },
  { label: '200k+',       min: 200000, max: null   },
];

const FilterSheet = ({ isOpen, onClose, activeFilters, onApply }) => {
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    const idx = PRICE_BRACKETS.findIndex(
      b => b.min === activeFilters.minPrice && b.max === activeFilters.maxPrice
    );
    setSelected(idx >= 0 ? idx : null);
  }, [isOpen]);

  const handleApply = () => {
    if (selected === null) {
      onApply({ minPrice: null, maxPrice: null });
    } else {
      const b = PRICE_BRACKETS[selected];
      onApply({ minPrice: b.min, maxPrice: b.max });
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl px-6 pt-4 pb-10
                       md:left-1/2 md:-translate-x-1/2 md:w-[420px] md:bottom-auto md:top-1/2
                       md:-translate-y-1/2 md:rounded-2xl shadow-xl"
          >
            {/* Drag handle (mobile only) */}
            <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-5 md:hidden" />

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                <h2 className="font-bold text-base">Filter</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Price brackets */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Price Range (UGX)</h3>
                {selected !== null && (
                  <button
                    onClick={() => setSelected(null)}
                    className="text-xs text-gray-400 hover:text-black dark:hover:text-white transition-all"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {PRICE_BRACKETS.map((bracket, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelected(selected === idx ? null : idx)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                      selected === idx
                        ? 'bg-[#EAAD11] border-[#EAAD11] text-black'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    {bracket.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Apply */}
            <button
              onClick={handleApply}
              className="w-full bg-black text-white py-3 rounded-xl font-bold text-sm hover:bg-gray-800 transition-all"
            >
              {selected !== null
                ? `Show items · ${PRICE_BRACKETS[selected].label}`
                : 'Show all items'}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FilterSheet;
