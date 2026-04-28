// This is the ItemCard component for the Thrifter frontend application. It displays an individual item with its image, name, market, vendor name (if available), and price formatted in Ugandan Shillings (UGX). The component uses Framer Motion for smooth animations when items are added or removed from the view. It also includes a button to remove the item from the wardrobe if the onRemove prop is provided. The image source is determined based on whether the image_path is a full URL or a relative path, and it handles both cases accordingly.
import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

const ItemCard = ({ item, onClick, onRemove }) => {
  const imgSrc = item.image_path.startsWith('http') 
    ? item.image_path 
    : `${import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')}/images/${item.image_path.split(/[\\/]/).pop()}`;
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
      <div className="item-card-shadow bg-white">
        <div className="relative item-card-inner overflow-hidden bg-gray-100" style={{ aspectRatio: '4 / 5' }}>
          <img 
            src={imgSrc} 
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
          {onRemove && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
              className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-900 px-2 py-1 rounded-full text-xs flex items-center gap-1 hover:bg-white z-10"
              title="Remove from Wardrobe"
            >
              <X className="w-3 h-3" />
              Remove
            </button>
          )}
        </div>
      </div>
      <div className="mt-3 px-1">
        <h3 className="font-medium text-gray-900 truncate">{item.name}</h3>
        <p className="text-sm text-gray-500">{item.market}</p>
        {item.vendor_name && (
          <p className="text-xs text-gray-500">{item.vendor_name}</p>
        )}
        <p className="text-sm font-semibold mt-0.5">{formatUGX(item.price)}</p>
      </div>
    </motion.div>
  );
};

export default ItemCard;
