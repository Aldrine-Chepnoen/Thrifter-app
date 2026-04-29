// This is the ProductModal component for the Thrifter frontend application. It displays detailed information about a specific product. For users, it provides options to add to wardrobe or chat with the vendor. For the item owner (vendor), it provides "Edit Listing" and "Delete Listing" buttons. The edit mode allows vendors to update the name, price, size, and description of their items without having to re-upload.
import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Heart, Edit, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import api from '../api';
import posthog from 'posthog-js';

const ProductModal = ({ item, isOpen, onClose, user, onDeleted, isWardrobe, openAuthModal, onUpdated }) => {
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState({
    name: '',
    price: '',
    size: '',
    description: ''
  });
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (item) {
      setEditedData({
        name: item.name,
        price: item.price,
        size: item.size,
        description: item.description || ''
      });
    }
    setEditMode(false);
  }, [item, isOpen]);

  if (!isOpen || !item) return null;
  
  const handleProtectedAction = (action) => {
    if (!user) {
      onClose();
      openAuthModal();
      return;
    }
    action();
  };

  const imgSrc = item.image_path.startsWith('http') 
    ? item.image_path 
    : `${import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')}/images/${item.image_path.split(/[\\/]/).pop()}`;
  
  const formatUGX = (n) => {
    try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
  };

  const isOwner = !!(user?.is_vendor && user?.vendor_name && item?.vendor_name && user.vendor_name === item.vendor_name);

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

  const handleConfirmEdit = async () => {
    setUpdating(true);
    try {
      const formData = new FormData();
      formData.append('name', editedData.name);
      formData.append('price', editedData.price);
      formData.append('size', editedData.size);
      formData.append('description', editedData.description);
      
      const res = await api.put(`/items/${item.id}`, formData);
      onUpdated && onUpdated(res.data);
      setEditMode(false);
    } catch (e) {
      alert('Failed to update item: ' + (e.response?.data?.detail || e.message));
    } finally {
      setUpdating(false);
    }
  };
  
  const handleAddWardrobe = async () => {
    handleProtectedAction(async () => {
      try {
        await api.post(`/wardrobe/${item.id}`);
        posthog.capture('item_added_to_wardrobe', {
          item_id: item.id,
          item_name: item.name,
          price: item.price
        });
        onClose();
      } catch (e) {
        const msg = e?.response?.data?.detail || e?.message || 'Failed to add to wardrobe';
        alert(msg);
      }
    });
  };

  const handleWhatsAppClick = (e) => {
    if (!user) {
      e.preventDefault();
      onClose();
      openAuthModal();
      return;
    }
    posthog.capture('whatsapp_contact_clicked', {
      item_id: item.id,
      item_name: item.name,
      vendor_name: item.vendor_name
    });
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

              {editMode ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold">Edit Item Details</h3>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Item Name</label>
                    <input 
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-black transition-all"
                      value={editedData.name}
                      onChange={(e) => setEditedData({...editedData, name: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Price (UGX)</label>
                      <input 
                        type="number"
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-black transition-all"
                        value={editedData.price}
                        onChange={(e) => setEditedData({...editedData, price: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Size</label>
                      <input 
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-black transition-all"
                        value={editedData.size}
                        onChange={(e) => setEditedData({...editedData, size: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Description</label>
                    <textarea 
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-black min-h-[100px] transition-all"
                      value={editedData.description}
                      onChange={(e) => setEditedData({...editedData, description: e.target.value})}
                    />
                  </div>
                </div>
              ) : (
                <>
                  {item.vendor_name && (
                    <p className="text-sm text-gray-600 mb-2">
                      Vendor: 
                      <Link 
                        to={`/vendor/${encodeURIComponent(item.vendor_name)}`} 
                        className="font-medium hover:underline"
                        onClick={onClose}
                      >
                        {item.vendor_name}
                      </Link>
                    </p>
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
                </>
              )}
            </div>

            {isOwner ? (
              <div className="space-y-3 pt-6">
                {editMode ? (
                  <>
                    <button
                      onClick={handleConfirmEdit}
                      disabled={updating}
                      className="w-full bg-[#25D366] text-white py-4 px-6 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#20bd5a] transition-colors shadow-lg shadow-green-500/10"
                    >
                      {updating ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-b-white rounded-full animate-spin" />
                          <span>Updating...</span>
                        </div>
                      ) : (
                        <><Check className="w-5 h-5" /> Confirm Changes</>
                      )}
                    </button>
                    <button
                      onClick={() => setEditMode(false)}
                      className="w-full bg-gray-100 text-gray-600 py-3 px-6 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setEditMode(true)}
                      className="w-full bg-[#25D366] text-white py-4 px-6 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#20bd5a] transition-colors shadow-lg shadow-green-500/10"
                    >
                      <Edit className="w-5 h-5" />
                      Edit Listing
                    </button>
                    <button
                      onClick={handleDelete}
                      className="w-full bg-red-600 text-white py-3 px-6 rounded-xl font-bold hover:bg-red-700 transition-colors opacity-80 hover:opacity-100"
                    >
                      Delete Listing
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                {!isWardrobe && (
                  <button
                    onClick={handleAddWardrobe}
                    className="w-full bg-black text-white py-3 px-6 rounded-xl font-bold hover:bg-gray-800 transition-colors mb-3 flex items-center justify-center gap-2"
                  >
                    <Heart className="w-5 h-5" />
                    Add to Wardrobe
                  </button>
                )}

                <a 
                  href={`https://wa.me/${(item.vendor_whatsapp || item.whatsapp) ?? ''}?text=${encodeURIComponent(`Hi, I saw your "${item.name}" on Thrifter. Is it still available?`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleWhatsAppClick}
                  className="w-full bg-[#25D366] text-white py-4 px-6 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#20bd5a] transition-colors mt-3"
                >
                  <MessageCircle className="w-5 h-5" />
                  Chat with Vendor
                </a>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ProductModal;
