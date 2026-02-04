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
      className="mb-4 break-inside-avoid cursor-pointer group"
      onClick={() => onClick(item)}
    >
      <div className="relative overflow-hidden rounded-xl bg-gray-100" style={{ aspectRatio: '4 / 5' }}>
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
            className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-900 px-2 py-1 rounded-full text-xs flex items-center gap-1 hover:bg-white"
            title="Remove from Wardrobe"
          >
            <X className="w-3 h-3" />
            Remove
          </button>
        )}
      </div>
      <div className="mt-2">
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
