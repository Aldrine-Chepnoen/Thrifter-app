import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Plus, Share2, Check, X } from 'lucide-react';
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
  const [viewStats, setViewStats] = useState({});

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
      if (isOwnProfile) {
        api.get(`/vendors/${encodeURIComponent(name)}/views`)
          .then(res => setViewStats(res.data || {}))
          .catch(() => {});
      }
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
    <main className="max-w-7xl mx-auto">
      {/* Hero banner — full width, no padding, no rounded corners */}
      <div className="relative h-44 md:h-60 bg-gradient-to-r from-[#D2850F] via-[#F4BD13] to-[#FAF6B5] overflow-hidden">
        <div className="absolute inset-0 bg-[url('/banner-texture.svg')] opacity-5 pointer-events-none" />
      </div>

      {/* Vendor info block */}
      <div className="px-4 md:px-6 pt-5 pb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-tight text-gray-900 dark:text-white leading-tight">
            {vendorInfo?.name || name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{items.length} items</p>
        </div>
        {isOwnProfile && (
          <button
            onClick={settingsOpen ? () => setSettingsOpen(false) : openSettings}
            className="flex-shrink-0 bg-[#EAAD11] text-black font-bold px-5 py-2 rounded-full text-sm hover:opacity-90 transition-all"
          >
            {settingsOpen ? 'Close' : 'Edit page'}
          </button>
        )}
      </div>
      <div className="border-b border-gray-100 dark:border-gray-800" />

      {/* Gold action bar */}
      <div className="bg-[#EAAD11] px-4 md:px-6 py-4 flex items-center justify-between gap-3">
        {isOwnProfile ? (
          <Link
            to="/upload"
            className="flex items-center gap-2 bg-white text-black font-bold px-5 py-2.5 rounded-full text-sm hover:opacity-90 transition-all"
          >
            <Plus className="w-4 h-4" />
            sell a piece
          </Link>
        ) : <div />}
        <button
          onClick={handleShare}
          className="flex items-center gap-2 bg-black/80 text-white font-bold px-5 py-2.5 rounded-full text-sm hover:opacity-90 transition-all"
        >
          {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
          {copied ? 'Copied!' : 'share profile'}
        </button>
      </div>

      {/* Settings panel */}
      {isOwnProfile && settingsOpen && (
        <div className="px-4 md:px-6 py-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-serif font-bold text-lg dark:text-white">Store Settings</h3>
            <button onClick={() => setSettingsOpen(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
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

      {/* Product grid */}
      <div className="px-4 md:px-6 mt-6">
        {loading ? (
          <ThrifterLoader />
        ) : items.length > 0 ? (
          <MasonryGrid items={items} onItemClick={setSelectedItem} viewStats={isOwnProfile ? viewStats : null} />
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
