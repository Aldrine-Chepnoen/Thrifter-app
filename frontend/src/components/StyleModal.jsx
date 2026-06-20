import React from 'react';
import { X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const StyleModal = ({ style, onClose, onBuild }) => {
  const coverImage = style.cover_image_path || style.sample_items?.[0]?.image_path || null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="relative w-full md:w-auto md:max-w-sm bg-white dark:bg-gray-900 rounded-t-[2.5rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl"
        >
          {/* Full-bleed cover with name overlay */}
          <div className="relative h-[58vh] md:h-[480px]">
            {coverImage ? (
              <img
                src={coverImage}
                alt={style.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900" />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/10" />

            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 bg-black/30 hover:bg-black/50 backdrop-blur-md rounded-full text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="absolute bottom-0 inset-x-0 p-7">
              <p className="text-[#EAAD11] text-[10px] font-bold uppercase tracking-[0.2em] mb-2">Aesthetic</p>
              <h2 className="text-white font-serif font-bold text-4xl leading-tight">
                {style.name}
              </h2>
            </div>
          </div>

          {/* Description + CTA */}
          <div className="p-7">
            {style.description && (
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed line-clamp-2 mb-6">
                {style.description}
              </p>
            )}
            <button
              onClick={() => onBuild(style)}
              className="w-full bg-[#EAAD11] text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95"
            >
              Build it
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default StyleModal;
