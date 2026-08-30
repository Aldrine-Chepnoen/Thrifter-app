// This is the ItemCard component for the Thrifter frontend application. It displays an individual item with its image, name, market, vendor name (if available), and price formatted in Ugandan Shillings (UGX). The component uses Framer Motion for smooth animations when items are added or removed from the view. It also includes a button to remove the item from the wardrobe if the onRemove prop is provided. The image source is determined based on whether the image_path is a full URL or a relative path, and it handles both cases accordingly.
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Heart, Eye, Lock } from 'lucide-react';
import { getImageSrc } from '../utils';

const ItemCard = ({ item, onClick, onRemove, onAddToWardrobe, wardrobeIds, viewData, saveData, hiddenBannerText }) => {
  const [saved, setSaved] = useState(() => wardrobeIds?.has(item.id) ?? false);
  // ~190 CSS px tile x 2-3x phone pixel density -> ask for 400
  const imgSrc = getImageSrc(item, 400);
  const formatUGX = (n) => {
    try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
  };
  return (
    <motion.div 
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="mb-6 break-inside-avoid cursor-pointer group px-1"
      onClick={() => onClick(item)}
    >
      <div className="item-card-shadow bg-white dark:bg-gray-800">
        <div className="relative item-card-inner overflow-hidden bg-gray-100 dark:bg-gray-700" style={{ aspectRatio: '4 / 5' }}>
          <img
            src={imgSrc}
            alt={item.name}
            loading="lazy"
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${item.is_hidden ? 'grayscale opacity-60' : ''}`}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
          {item.is_hidden && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent pt-8 pb-2 px-2.5 pointer-events-none">
              <div className="flex items-center gap-1 text-white">
                <Lock className="w-3 h-3 flex-shrink-0" />
                <span className="text-xs font-semibold">{hiddenBannerText || 'Unavailable — upgrade to unlock'}</span>
              </div>
            </div>
          )}
          {(viewData || saveData != null) && !item.is_hidden && (
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent pt-8 pb-2 px-2.5 pointer-events-none">
              <div className="flex items-center gap-3 text-white">
                {viewData && (
                  <div className="flex items-center gap-1">
                    <Eye className="w-3 h-3 flex-shrink-0" />
                    <span className="text-xs font-semibold">{viewData.last_7_days} this week</span>
                  </div>
                )}
                {saveData != null && (
                  <div className="flex items-center gap-1">
                    <Heart className="w-3 h-3 flex-shrink-0" />
                    <span className="text-xs font-semibold">{saveData} saved</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
              className="absolute top-2 right-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 rounded-full text-xs flex items-center gap-1 hover:bg-white dark:hover:bg-gray-800 z-10"
              title="Remove from Wardrobe"
            >
              <X className="w-3 h-3" />
              Remove
            </button>
          )}
        </div>
      </div>
      <div className="relative mt-3 px-1">
        {onAddToWardrobe && !onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const next = !saved;
              setSaved(next);
              onAddToWardrobe(item.id, saved).catch(() => setSaved(saved));
            }}
            className="absolute top-0 right-0 p-1"
            title="Save to Wardrobe"
          >
            <Heart
              className={`w-4 h-4 transition-colors duration-150 ${saved ? 'fill-[#EAAD11] text-[#EAAD11]' : 'text-gray-400 dark:text-gray-500 hover:text-[#EAAD11]'}`}
            />
          </button>
        )}
        <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate pr-6">{item.name}</h3>
        {item.vendor_name && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{item.vendor_name}</p>
        )}
        <p className="text-sm font-semibold mt-0.5">{formatUGX(item.price)}</p>
      </div>
    </motion.div>
  );
};

export default ItemCard;
