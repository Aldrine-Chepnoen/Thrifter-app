import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Plus, Menu, X, Share2, Check } from 'lucide-react';
import MasonryGrid from './MasonryGrid';
import api from '../api';
import ThrifterLoader from './ThrifterLoader';

const VendorPage = ({ setSelectedItem, user, onItemDeleted, refreshKey, onVendorRenamed }) => {
  const { name } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendorInfo, setVendorInfo] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const isOwnProfile = user?.vendor_name?.toLowerCase() === name?.toLowerCase();

  const fetchVendorItems = async () => {
    setLoading(true);
    try {
      const [itemsRes, vendorRes] = await Promise.all([
        api.get(`/items?vendor=${encodeURIComponent(name)}`),
        api.get(`/vendors/${encodeURIComponent(name)}`),
      ]);
      setItems(itemsRes.data || []);
      setVendorInfo(vendorRes.data || null);
    } catch (e) {
      console.error('Failed to load vendor items', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendorItems();
  }, [name, refreshKey]);

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openSettings = () => {
    setEditName(vendorInfo?.name || name);
    setEditWhatsapp(user?.vendor_whatsapp || '');
    setError('');
    setSettingsOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api.put('/vendor/me', { name: editName, whatsapp: editWhatsapp });
      const newName = res.data.vendor_name;
      onVendorRenamed?.(newName);
      setSettingsOpen(false);
      if (newName.toLowerCase() !== name.toLowerCase()) {
        navigate(`/vendor/${encodeURIComponent(newName)}`, { replace: true });
      } else {
        setVendorInfo(prev => ({ ...prev, name: newName, whatsapp: res.data.vendor_whatsapp }));
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-6">
      <div className="relative h-40 md:h-52 bg-gradient-to-r from-[#D2850F] via-[#F4BD13] to-[#FAF6B5] rounded-2xl overflow-hidden mb-8 shadow-inner input-shadow border border-[#EAAD11]/20">
        <div className="absolute inset-0 bg-[url('/banner-texture.svg')] opacity-5 pointer-events-none"></div>
        <div className="h-full w-full flex items-center justify-center">
          <div className="px-6 md:px-8 text-center banner-text-shadow">
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-white tracking-tight">{vendorInfo?.name || name}</h1>
            <p className="text-sm text-white mt-2 font-semibold opacity-90">
              {items.length} curated item(s)
            </p>
          </div>
        </div>

        <button
          onClick={handleShare}
          className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 bg-black/20 hover:bg-black/30 rounded-lg text-white text-xs font-medium transition-all"
          title="Copy store link"
        >
          {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
          {copied ? 'Copied to clipboard' : 'Share'}
        </button>

        {isOwnProfile && (
          <button
            onClick={settingsOpen ? () => setSettingsOpen(false) : openSettings}
            className="absolute top-3 right-3 p-2 bg-black/20 hover:bg-black/30 rounded-lg text-white transition-all"
            title="Store settings"
          >
            {settingsOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}
      </div>

      {isOwnProfile && settingsOpen && (
        <div className="mb-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
          <h3 className="font-serif font-bold text-lg mb-5 dark:text-white">Store Settings</h3>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">Store Name</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full p-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-1 focus:ring-black dark:focus:ring-gray-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">WhatsApp Number</label>
              <input
                type="text"
                value={editWhatsapp}
                onChange={e => setEditWhatsapp(e.target.value)}
                placeholder="+256..."
                className="w-full p-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-1 focus:ring-black dark:focus:ring-gray-500 outline-none"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 bg-[#EAAD11] text-black font-bold rounded-xl hover:opacity-90 transition-all input-shadow disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                onClick={() => setSettingsOpen(false)}
                className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isOwnProfile && (
        <div className="flex justify-end mb-6">
          <Link
            to="/upload"
            className="flex items-center gap-2 bg-[#EAAD11] text-black px-6 py-3 rounded-xl hover:opacity-90 transition-all font-bold shadow-lg shadow-black/10 input-shadow"
          >
            <Plus className="w-5 h-5" />
            <span>Sell Item</span>
          </Link>
        </div>
      )}

      <div>
        {loading ? (
          <ThrifterLoader />
        ) : items.length > 0 ? (
          <MasonryGrid items={items} onItemClick={setSelectedItem} />
        ) : (
          <div className="text-center py-20 text-gray-500">
            <p>No items from this vendor yet.</p>
          </div>
        )}
      </div>
    </main>
  );
};

export default VendorPage;
