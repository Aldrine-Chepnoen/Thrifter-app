// This is the UploadForm component for the Thrifter frontend application. It provides a form for vendors to list new items for sale. The form includes fields for item details such as name, price, size, market, vendor information, and a description, as well as an image upload feature with a preview. The component checks if the user is authenticated and has a vendor account before allowing them to submit the form. Upon submission, it sends the form data to the backend API and handles success and error responses accordingly. The component also uses Tailwind CSS for styling and React hooks for managing state and side effects.
import React, { useState, useEffect } from 'react';
import { Upload, X } from 'lucide-react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

const UploadForm = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    size: '',
    market: '',
    item_type: 'top',
    vendor_name: '',
    vendor_whatsapp: '',
    description: '',
    file: null
  });
  const [preview, setPreview] = useState(null);
  const [canUpload, setCanUpload] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.get('/auth/me');
        setUserInfo(me.data);
        setCanUpload(!!me.data?.is_vendor);
        if (me.data?.is_vendor) {
          setFormData((prev) => ({
            ...prev,
            vendor_name: prev.vendor_name || me.data.vendor_name || '',
            vendor_whatsapp: prev.vendor_whatsapp || me.data.vendor_whatsapp || ''
          }));
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

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, file });
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canUpload) {
      alert('Login with a business account to list items');
      navigate('/auth');
      return;
    }
    setLoading(true);

    const data = new FormData();
    Object.keys(formData).forEach(key => {
      data.append(key, formData[key]);
    });

    try {
      await api.post('/upload', data);
      navigate('/');
    } catch (error) {
      console.error('Upload failed:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to upload item';
      alert(`Upload failed: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-3xl font-serif font-bold mb-8">Sell an Item</h2>
      {!authChecked ? (
        <div className="mb-4 text-sm text-gray-600">Checking account...</div>
      ) : !canUpload ? (
        <div className="mb-4 text-sm text-red-600">You need a business account to list items.</div>
      ) : null}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Image Upload */}
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 mb-2">Item Photo</label>
          <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors">
            {preview ? (
              <div className="relative">
                <img src={preview} alt="Preview" className="max-h-64 mx-auto rounded-lg" />
                <button 
                  type="button" 
                  onClick={() => { setPreview(null); setFormData({ ...formData, file: null }); }}
                  className="absolute top-2 right-2 bg-white p-1 rounded-full shadow-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">Click to upload or drag and drop</p>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  required
                />
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
            <input 
              type="text" 
              name="name"
              value={formData.name} 
              onChange={handleChange}
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
              required
              disabled={!canUpload}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price (UGX)</label>
            <input 
              type="number" 
              name="price"
              value={formData.price} 
              onChange={handleChange}
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
              required
              disabled={!canUpload}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
            <input 
              type="text" 
              name="size"
              value={formData.size} 
              onChange={handleChange}
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
              required
              disabled={!canUpload}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Market / Location</label>
            <input 
              type="text" 
              name="market"
              value={formData.market} 
              onChange={handleChange}
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
              required
              disabled={!canUpload}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Category</label>
            <select 
              name="item_type"
              value={formData.item_type} 
              onChange={handleChange}
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white"
              required
              disabled={!canUpload}
            >
              <option value="top">Top (Shirt, Jacket, etc.)</option>
              <option value="bottom">Bottom (Pants, Skirt, etc.)</option>
              <option value="dress">Dress / Jumpsuit</option>
              <option value="accessory">Accessory (Shoes, Bag, etc.)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name</label>
            <input 
              type="text" 
              name="vendor_name"
              value={formData.vendor_name} 
              onChange={handleChange}
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
              required
              disabled={!canUpload}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor WhatsApp</label>
            <input 
              type="text" 
              name="vendor_whatsapp"
              value={formData.vendor_whatsapp} 
              onChange={handleChange}
              placeholder="e.g. +2348012345678"
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
              required
              disabled={!canUpload}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea 
            name="description"
            value={formData.description} 
            onChange={handleChange}
            rows="4"
            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
            disabled={!canUpload}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading || !canUpload}
          className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-colors disabled:bg-gray-400"
        >
          {loading ? 'Listing Item...' : 'List Item'}
        </button>
      </form>
    </div>
  );
};

export default UploadForm;
