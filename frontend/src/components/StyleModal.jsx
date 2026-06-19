import React from 'react';
import { X, Hammer, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const StyleModal = ({ style, onClose, onBuild }) => {
  const sampleItems = style.sample_items || [];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-t-[2.5rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header Image Gallery */}
          <div className="h-64 md:h-80 relative bg-gray-100 dark:bg-gray-800 flex gap-1 overflow-x-auto no-scrollbar">
            {style.cover_image_path ? (
              <img
                src={style.cover_image_path}
                className="h-full w-full object-cover shrink-0"
                alt={style.name}
              />
            ) : sampleItems.length > 0 ? (
              sampleItems.map((item, idx) => (
                <img
                  key={idx}
                  src={item.image_path}
                  className="h-full w-auto min-w-[200px] object-cover"
                  alt=""
                />
              ))
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 italic font-serif">
                Aesthetic Preview
              </div>
            )}

            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full text-white transition-all z-10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-8 md:p-10 flex flex-col">
            <h2 className="text-3xl font-serif font-bold text-gray-900 dark:text-white mb-3">
              {style.name}
            </h2>

            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-8">
              {style.description}
            </p>

            <button
              onClick={() => onBuild(style)}
              className="w-full bg-[#EAAD11] text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-all input-shadow active:scale-95"
            >
              <Hammer className="w-5 h-5" />
              Build this Style
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default StyleModal;
