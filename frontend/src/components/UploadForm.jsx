// This is the UploadForm component for the Thrifter frontend application. It provides a form for vendors to list new items for sale. The form includes fields for item details such as name, price, size, market, vendor information, and a description, as well as an image upload feature with a preview. The component checks if the user is authenticated and has a vendor account before allowing them to submit the form. Upon submission, it sends the form data to the backend API and handles success and error responses accordingly. The component also uses Tailwind CSS for styling and React hooks for managing state and side effects.
import React, { useState, useEffect } from 'react';
import { Upload, X } from 'lucide-react';
import api, { fetchVendorSlotStatus } from '../api';
import { useNavigate } from 'react-router-dom';
import UpgradeToPremiumModal from './UpgradeToPremiumModal';
import { useToast } from '../context/ToastContext';

const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.85;

function resizeImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width, height } = img;
      const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })),
        'image/jpeg',
        JPEG_QUALITY
      );
    };
    img.src = url;
  });
}

const UploadForm = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [uploadStatus, setUploadStatus] = useState(null); // null | 'resizing' | 'uploading'
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    size: '',
    item_type: 'top',
    quantity: 1,
    description: '',
  });
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [canUpload, setCanUpload] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [slotBlocked, setSlotBlocked] = useState(false);
  const [slotCheckFailed, setSlotCheckFailed] = useState(false);
  const [checkingSlot, setCheckingSlot] = useState(false);
  // Fail closed: until we've positively confirmed the vendor has room, the
  // form stays disabled — covers the initial load, a slow/failed slot check,
  // and the confirmed-over-limit case with the same guard, so there's never
  // a window where the form is fillable but we don't actually know yet.
  const formDisabled = !authChecked || !canUpload || slotBlocked || slotCheckFailed;

  const checkSlotStatus = async () => {
    setCheckingSlot(true);
    setSlotCheckFailed(false);
    try {
      const slotStatus = await fetchVendorSlotStatus();
      if (!slotStatus.is_premium && slotStatus.active_item_count >= slotStatus.free_item_limit) {
        setSlotBlocked(true);
        setShowUpgradeModal(true);
      } else {
        setSlotBlocked(false);
      }
    } catch {
      // Deliberately fails CLOSED (form stays disabled via slotCheckFailed)
      // rather than silently letting the vendor fill in a form we can't
      // confirm they're allowed to submit — surfaced with a retry below.
      setSlotCheckFailed(true);
    } finally {
      setCheckingSlot(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const me = await api.get('/auth/me');
        setUserInfo(me.data);
        setCanUpload(!!me.data?.is_vendor);
        if (me.data?.is_vendor) {
          // Check slot status up front so a maxed-out vendor sees the upgrade
          // prompt immediately, before filling in the whole form only to hit
          // a rejection on submit.
          await checkSlotStatus();
        }
      } catch {
        setCanUpload(false);
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    const resized = await Promise.all(selectedFiles.map(resizeImage));
    const newFiles = [...files, ...resized].slice(0, 3);
    setFiles(newFiles);
    setPreviews(newFiles.map(f => URL.createObjectURL(f)));
  };

  const removeFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    setPreviews(newFiles.map(f => URL.createObjectURL(f)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canUpload) {
      showToast('Login with a business account to list items');
      navigate('/');
      return;
    }
    if (slotBlocked) {
      setShowUpgradeModal(true);
      return;
    }
    if (slotCheckFailed) {
      showToast("We couldn't confirm your account status. Please retry the check above before listing an item.");
      return;
    }
    if (files.length === 0) {
      showToast('Please upload at least one image');
      return;
    }
    setUploadStatus('uploading');

    const data = new FormData();
    Object.keys(formData).forEach(key => {
      data.append(key, formData[key]);
    });
    files.forEach(file => data.append('files', file));

    try {
      const res = await api.post('/upload', data);
      navigate(`/vendor/${encodeURIComponent(res.data.vendor_name)}`);
    } catch (error) {
      console.error('Upload failed:', error);
      const detail = error.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.code === 'slot_limit_reached') {
        setShowUpgradeModal(true);
      } else {
        const errorMsg = (typeof detail === 'string' && detail) || 'Failed to upload item';
        showToast(`Upload failed: ${errorMsg}`);
      }
    } finally {
      setUploadStatus(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-3xl font-serif font-bold mb-8">Sell an Item</h2>
      {!authChecked ? (
        <div className="mb-4 text-sm text-gray-600">Checking account...</div>
      ) : !canUpload ? (
        <div className="mb-4 text-sm text-red-600">You need a business account to list items.</div>
      ) : slotCheckFailed ? (
        <div className="mb-4 text-sm text-red-600 flex items-center gap-3">
          <span>We couldn't confirm your account status, so listing is paused for now.</span>
          <button
            type="button"
            onClick={checkSlotStatus}
            disabled={checkingSlot}
            className="text-[#EAAD11] font-semibold hover:underline disabled:opacity-50"
          >
            {checkingSlot ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      ) : slotBlocked ? (
        <div className="mb-4 text-sm text-red-600 flex items-center gap-3">
          <span>You've reached your free plan's item limit.</span>
          <button
            type="button"
            onClick={() => setShowUpgradeModal(true)}
            className="text-[#EAAD11] font-semibold hover:underline"
          >
            Upgrade to Premium
          </button>
        </div>
      ) : null}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Image Upload */}
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Item Photos (Up to 3) <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {previews.map((preview, index) => (
              <div key={index} className="relative aspect-[4/5] bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden group">
                <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="absolute top-2 right-2 bg-white/90 dark:bg-gray-800/90 p-1.5 rounded-full shadow-md hover:bg-white dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                {index === 0 && (
                  <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                    Primary
                  </span>
                )}
              </div>
            ))}
            {files.length < 3 && (
              <label className={`relative aspect-[4/5] border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center transition-colors ${formDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                <Upload className="w-8 h-8 text-gray-400 mb-1" />
                <span className="text-[11px] text-gray-500 font-medium">Add Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  disabled={formDisabled}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
              </label>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Item Name <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              name="name"
              value={formData.name} 
              onChange={handleChange}
              className="w-full p-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-1 focus:ring-black dark:focus:ring-gray-500 outline-none"
              required
              disabled={formDisabled}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price (UGX) <span className="text-red-500">*</span></label>
            <input 
              type="number" 
              name="price"
              value={formData.price} 
              onChange={handleChange}
              className="w-full p-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-1 focus:ring-black dark:focus:ring-gray-500 outline-none"
              required
              disabled={formDisabled}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Size <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              name="size"
              value={formData.size} 
              onChange={handleChange}
              className="w-full p-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-1 focus:ring-black dark:focus:ring-gray-500 outline-none"
              required
              disabled={formDisabled}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Item Category <span className="text-red-500">*</span></label>
            <select 
              name="item_type"
              value={formData.item_type} 
              onChange={handleChange}
              className="w-full p-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-1 focus:ring-black dark:focus:ring-gray-500 outline-none bg-white"
              required
              disabled={formDisabled}
            >
              <option value="top">Top (Shirt, Jacket, etc.)</option>
              <option value="bottom">Bottom (Pants, Skirt, etc.)</option>
              <option value="dress">Dress / Jumpsuit</option>
              <option value="accessory">Accessory (Shoes, Bag, etc.)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity <span className="text-red-500">*</span></label>
            <input
              type="number"
              name="quantity"
              min="0"
              value={formData.quantity}
              onChange={handleChange}
              className="w-full p-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-1 focus:ring-black dark:focus:ring-gray-500 outline-none"
              required
              disabled={formDisabled}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="4"
            className="w-full p-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-1 focus:ring-black dark:focus:ring-gray-500 outline-none"
            disabled={formDisabled}
          />
        </div>

        <button
          type="submit"
          disabled={!!uploadStatus || formDisabled}
          className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
        >
          {uploadStatus && (
            <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {uploadStatus === 'uploading' ? 'Listing item...' : 'List Item'}
        </button>
      </form>
      <UpgradeToPremiumModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </div>
  );
};

export default UploadForm;
