// This is the ProductModal component for the Thrifter frontend application. It displays detailed information about a specific product. For users, it provides options to add to wardrobe or chat with the vendor. For the item owner (vendor), it provides "Edit Listing" and "Delete Listing" buttons. The edit mode allows vendors to update the name, price, size, and description of their items without having to re-upload.
import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Heart, Edit, Check, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import api from '../api';
import posthog from 'posthog-js';
import { getOptimizedCloudinaryUrl } from '../utils';

const ProductModal = ({ item, isOpen, onClose, user, onDeleted, isWardrobe, openAuthModal, onUpdated }) => {
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState({
    name: '',
    price: '',
    size: '',
    market: '',
    description: ''
  });
  const [updating, setUpdating] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [viewStats, setViewStats] = useState(null);
  const location = useLocation();
  const isOnOwnVendorPage = location.pathname.toLowerCase() === `/vendor/${user?.vendor_name?.toLowerCase()}`;

  useEffect(() => {
    if (item) {
      setEditedData({
        name: item.name,
        price: item.price,
        size: item.size,
        market: item.market || '',
        description: item.description || ''
      });
      setActiveImageIndex(0);
    }
    setEditMode(false);
  }, [item, isOpen]);

  useEffect(() => {
    if (!isOpen || !item) { setViewStats(null); return; }
    const isOwnerNow = !!(user?.is_vendor && user?.vendor_name && item?.vendor_name && user.vendor_name === item.vendor_name);
    if (!isOwnerNow) {
      const sessionKey = `viewed_${item.id}`;
      if (!sessionStorage.getItem(sessionKey)) {
        api.post(`/items/${item.id}/view`).catch(() => {});
        sessionStorage.setItem(sessionKey, '1');
      }
    }
    if (isOwnerNow && isOnOwnVendorPage) {
      api.get(`/items/${item.id}/views`).then(res => setViewStats(res.data)).catch(() => {});
    } else {
      setViewStats(null);
    }
  }, [item?.id, isOpen, user?.id]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen || !item) return null;
  
  const handleProtectedAction = (action) => {
    if (!user) {
      onClose();
      openAuthModal();
      return;
    }
    action();
  };

  const images = item.images && item.images.length > 0
    ? item.images
    : [{ image_path: item.image_path, id: 'legacy' }];

  const getFullUrl = (path) => path.startsWith('http')
    ? path
    : `${import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')}/images/${path.split(/[\\/]/).pop()}`;

  const activeImage = images[activeImageIndex] || images[0];
  const mainImgSrc = getOptimizedCloudinaryUrl(getFullUrl(activeImage.image_path), 800);
  
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
      formData.append('market', editedData.market);
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
          className="relative bg-white dark:bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 bg-white/80 dark:bg-gray-800/80 rounded-full hover:bg-white dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">

          <div className="w-full md:w-1/2 bg-gray-100 dark:bg-gray-800 max-h-[60vh] md:max-h-[80vh] flex flex-col">
            <div className="flex-1 flex items-center justify-center overflow-hidden">
              <img
                src={mainImgSrc}
                alt={item.name}
                className="max-h-full w-auto object-contain transition-all duration-300"
              />
            </div>

            {images.length > 1 && (
              <div className="p-4 flex justify-center gap-3 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`w-16 h-20 rounded-lg overflow-hidden border-2 transition-all ${activeImageIndex === idx ? 'border-black dark:border-white scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    <img
                      src={getOptimizedCloudinaryUrl(getFullUrl(img.image_path), 150)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-full md:w-1/2 p-8 flex flex-col md:overflow-y-auto">
            <div className="mb-auto">
              {viewStats && !editMode && (
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" /> Views
                  </p>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{viewStats.last_7_days}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Past week</p>
                    </div>
                    <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
                    <div>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{viewStats.last_30_days}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Past month</p>
                    </div>
                  </div>
                </div>
              )}
              <span className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-medium tracking-wider uppercase mb-4">
                {item.market}
              </span>

              {editMode ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold">Edit Item Details</h3>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Item Name</label>
                    <input 
                      className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-1 focus:ring-black dark:focus:ring-gray-500 transition-all"
                      value={editedData.name}
                      onChange={(e) => setEditedData({...editedData, name: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Price (UGX)</label>
                      <input
                        type="number"
                        className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-1 focus:ring-black dark:focus:ring-gray-500 transition-all"
                        value={editedData.price}
                        onChange={(e) => setEditedData({...editedData, price: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Size</label>
                      <input
                        className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-1 focus:ring-black dark:focus:ring-gray-500 transition-all"
                        value={editedData.size}
                        onChange={(e) => setEditedData({...editedData, size: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Location</label>
                    <input
                      className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-1 focus:ring-black dark:focus:ring-gray-500 transition-all"
                      value={editedData.market}
                      onChange={(e) => { const v = e.target.value; setEditedData(prev => ({...prev, market: v})); }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Description</label>
                    <textarea 
                      className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-black dark:focus:ring-gray-500 min-h-[100px] transition-all"
                      value={editedData.description}
                      onChange={(e) => setEditedData({...editedData, description: e.target.value})}
                    />
                  </div>
                </div>
              ) : (
                <>
                  {item.vendor_name && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
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
                  <h2 className="text-3xl font-serif font-bold text-gray-900 dark:text-white mb-2">{item.name}</h2>
                  <p className="text-2xl font-medium text-gray-900 dark:text-white mb-6">{formatUGX(item.price)}</p>
                  
                  <div className="space-y-4 mb-8">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide mb-1">Size</h3>
                      <p className="text-gray-600 dark:text-gray-400">{item.size}</p>
                    </div>
                    {item.description && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide mb-1">Description</h3>
                        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{item.description}</p>
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
                      className="w-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 py-3 px-6 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
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
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ProductModal;
