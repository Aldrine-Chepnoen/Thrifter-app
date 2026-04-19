// This is the ProductModal component for the Thrifter frontend application. It displays detailed information about a specific product in a modal window when the user clicks on an item. The modal includes the product image, name, price, size, description, and vendor information if available. It also provides buttons for adding the item to the user's wardrobe, chatting with the vendor via WhatsApp, and deleting the listing if the user is the vendor. The component uses Framer Motion for smooth animations when opening and closing the modal, and it handles API interactions for adding items to the wardrobe and deleting listings. The image source is determined based on whether the image_path is a full URL or a relative path, ensuring that images are displayed correctly regardless of their source.
import React from 'react';
import { X, MessageCircle, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import api from '../api';

const ProductModal = ({ item, isOpen, onClose, user, onDeleted }) => {
  if (!isOpen || !item) return null;
  const imgSrc = item.image_path.startsWith('http') 
    ? item.image_path 
    : `${import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')}/images/${item.image_path.split(/[\\/]/).pop()}`;
  const formatUGX = (n) => {
    try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
  };
  const canDelete = !!(user?.is_vendor && user?.vendor_name && item?.vendor_name && user.vendor_name === item.vendor_name);

  const handleDelete = async () => {
    const ok = window.confirm('Delete this listing? This cannot be undone.');
    if (!ok) return;
    try {
      await api.delete(`/items/${item.id}`);
      onDeleted && onDeleted(item.id);
      onClose();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to delete listing';
      alert(msg);
    }
  };
  
  const handleAddWardrobe = async () => {
    if (!user) {
      alert('Login to add items to your wardrobe');
      return;
    }
    try {
      await api.post(`/wardrobe/${item.id}`);
      alert('Added to your wardrobe');
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to add to wardrobe';
      alert(msg);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white rounded-2xl overflow-y-auto w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row shadow-2xl"
        >
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 bg-white/80 rounded-full hover:bg-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-full md:w-1/2 bg-gray-100 max-h-[60vh] md:max-h-[80vh] flex items-center justify-center">
            <img 
              src={imgSrc} 
              alt={item.name}
              className="max-h-[60vh] md:max-h-[80vh] w-auto object-contain"
            />
          </div>

          <div className="w-full md:w-1/2 p-8 flex flex-col overflow-y-auto">
            <div className="mb-auto">
              <span className="inline-block px-3 py-1 bg-gray-100 rounded-full text-xs font-medium tracking-wider uppercase mb-4">
                {item.market}
              </span>
              {item.vendor_name && (
                <p className="text-sm text-gray-600 mb-2">Vendor: <Link to={`/vendor/${encodeURIComponent(item.vendor_name)}`} className="font-medium hover:underline">{item.vendor_name}</Link></p>
              )}
              <h2 className="text-3xl font-serif font-bold text-gray-900 mb-2">{item.name}</h2>
              <p className="text-2xl font-medium text-gray-900 mb-6">{formatUGX(item.price)}</p>
              
              <div className="space-y-4 mb-8">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-1">Size</h3>
                  <p className="text-gray-600">{item.size}</p>
                </div>
                {item.description && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-1">Description</h3>
                    <p className="text-gray-600 leading-relaxed">{item.description}</p>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleAddWardrobe}
              className="w-full bg-black text-white py-3 px-6 rounded-xl font-bold hover:bg-gray-800 transition-colors mb-3 flex items-center justify-center gap-2"
            >
              <Heart className="w-5 h-5" />
              Add to Wardrobe
            </button>
            {canDelete && (
              <button
                onClick={handleDelete}
                className="w-full bg-red-600 text-white py-3 px-6 rounded-xl font-bold hover:bg-red-700 transition-colors"
              >
                Delete Listing
              </button>
            )}

            <a 
              href={`https://wa.me/${(item.vendor_whatsapp || item.whatsapp) ?? ''}?text=${encodeURIComponent(`Hi, I saw your "${item.name}" on Thrifter. Is it still available?`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-[#25D366] text-white py-4 px-6 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#20bd5a] transition-colors mt-6"
            >
              <MessageCircle className="w-5 h-5" />
              Chat with Vendor
            </a>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ProductModal;
