import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Share2, Check, X, Camera, MapPin, Crown } from 'lucide-react';
import MasonryGrid from './MasonryGrid';
import VendorOrders from './VendorOrders';
import UpgradeToPremiumModal from './UpgradeToPremiumModal';
import api, { fetchVendorSlotStatus } from '../api';
import { getImageSrc } from '../utils';
import ThrifterLoader from './ThrifterLoader';

const formatUGX = (n) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
};

const VendorPage = ({ setSelectedItem, user, onItemDeleted, refreshKey, onVendorRenamed }) => {
  const { name } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const verifyToken = searchParams.get('verify');
  const [confirmedToken] = useState(() => verifyToken);
  const [verifyState, setVerifyState] = useState(verifyToken ? 'checking' : null);
  const [verifyLocationInput, setVerifyLocationInput] = useState('');
  const [verifyLocationSaving, setVerifyLocationSaving] = useState(false);
  const [verifyLocationSaved, setVerifyLocationSaved] = useState(false);
  const [verifyLocating, setVerifyLocating] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendorInfo, setVendorInfo] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [viewStats, setViewStats] = useState({});
  const [bannerUploading, setBannerUploading] = useState(false);
  const bannerInputRef = useRef(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [refreshingSubscription, setRefreshingSubscription] = useState(false);

  const isOwnProfile = user?.vendor_name?.toLowerCase() === name?.toLowerCase();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'orders' ? 'orders' : 'items');

  // GET /vendor/me/subscription actively re-verifies a still-pending payment
  // against the provider, so re-calling this is how "Check payment status"
  // resolves a pending payment without waiting for the webhook.
  const refreshSubscriptionStatus = async () => {
    setRefreshingSubscription(true);
    try {
      const res = await fetchVendorSlotStatus();
      setSubscriptionStatus(res);
    } catch {
      // Leave the last-known status displayed rather than clearing it.
    } finally {
      setRefreshingSubscription(false);
    }
  };

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
        // View stats are Premium-only — skip the call entirely for a free
        // vendor rather than firing a request we know the backend will 403.
        if (vendorRes.data?.is_premium) {
          api.get(`/vendors/${encodeURIComponent(name)}/views`)
            .then(res => setViewStats(res.data || {}))
            .catch(() => {});
        } else {
          setViewStats({});
        }
        fetchVendorSlotStatus()
          .then(setSubscriptionStatus)
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

  useEffect(() => {
    if (!verifyToken) return;
    api.post('/vendors/verify', { token: verifyToken })
      .then(res => setVerifyState(res.data.status))
      .catch(() => setVerifyState('invalid'))
      .finally(() => {
        searchParams.delete('verify');
        setSearchParams(searchParams, { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyToken]);

  useEffect(() => {
    if (verifyState === 'confirmed' && vendorInfo) {
      setVerifyLocationInput(prev => prev || vendorInfo.location || '');
    }
  }, [verifyState, vendorInfo]);

  const handleUseMyLocationForVerify = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser. Please type your pickup location instead.');
      return;
    }
    if (!window.confirm('Are you sure you want to use your current location as your pickup location?')) {
      return;
    }
    setVerifyLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await api.post('/geocode/reverse', {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setVerifyLocationInput(res.data.address);
        } catch (e) {
          alert(e?.response?.data?.detail || 'Could not determine your address. Please type your pickup location instead.');
        } finally {
          setVerifyLocating(false);
        }
      },
      () => {
        setVerifyLocating(false);
        alert('Could not get your location. Please type your pickup location instead.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSaveVerifyLocation = async () => {
    if (!confirmedToken || !verifyLocationInput.trim()) return;
    setVerifyLocationSaving(true);
    try {
      await api.post('/vendors/verify/location', { token: confirmedToken, location: verifyLocationInput.trim() });
      setVerifyLocationSaved(true);
      setVendorInfo(prev => prev ? { ...prev, location: verifyLocationInput.trim() } : prev);
    } catch (e) {
      alert('Failed to save your location. Please try again.');
    } finally {
      setVerifyLocationSaving(false);
    }
  };

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openSettings = () => {
    setEditName(vendorInfo?.name || name);
    setEditWhatsapp(user?.vendor_whatsapp || '');
    setEditDescription(vendorInfo?.description || '');
    setEditLocation(vendorInfo?.location || '');
    setError('');
    setSettingsOpen(true);
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBannerUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/vendor/me/banner', formData);
      setVendorInfo(prev => ({
        ...prev,
        banner_image: res.data.banner_image,
        banner_fallback_url: res.data.banner_fallback_url,
      }));
    } catch {
      alert('Failed to upload banner image');
    } finally {
      setBannerUploading(false);
      e.target.value = null;
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser. Please type your pickup location instead.');
      return;
    }
    if (!window.confirm('Are you sure you want to use your current location as your pickup location?')) {
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await api.post('/geocode/reverse', {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setEditLocation(res.data.address);
        } catch (e) {
          alert(e?.response?.data?.detail || 'Could not determine your address. Please type your pickup location instead.');
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        alert('Could not get your location. Please type your pickup location instead.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api.put('/vendor/me', {
        name: editName,
        whatsapp: editWhatsapp,
        description: editDescription || null,
        location: editLocation.trim() || null,
      });
      const newName = res.data.vendor_name;
      onVendorRenamed?.(newName);
      setSettingsOpen(false);
      if (newName.toLowerCase() !== name.toLowerCase()) {
        navigate(`/vendor/${encodeURIComponent(newName)}`, { replace: true });
      } else {
        setVendorInfo(prev => ({
          ...prev,
          name: newName,
          whatsapp: res.data.vendor_whatsapp,
          description: editDescription || null,
          location: editLocation.trim() || null,
        }));
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const verifyModalContent = {
    checking: { title: 'Confirming…', body: null },
    expired: { title: 'This link has expired', body: "This verification window has closed. Contact us if you're still an active seller." },
    invalid: { title: "This link isn't valid", body: 'Please use the confirmation link from your email.' },
  }[verifyState];

  return (
    <main className="max-w-7xl mx-auto">
      {verifyState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-sm w-full p-6 text-center shadow-xl">
            {verifyState === 'checking' && <ThrifterLoader />}

            {verifyState === 'confirmed' && !verifyLocationSaved && (
              <>
                <h3 className="font-serif font-bold text-lg dark:text-white mb-2">You're verified!</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  Please confirm your pickup location so we can arrange deliveries.
                </p>
                <div className="flex items-center justify-end mb-1.5">
                  <button
                    type="button"
                    onClick={handleUseMyLocationForVerify}
                    disabled={verifyLocating}
                    className="flex items-center gap-1 text-xs font-semibold text-black dark:text-white hover:underline disabled:opacity-50"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    {verifyLocating ? 'Locating…' : 'Use my location'}
                  </button>
                </div>
                <input
                  type="text"
                  value={verifyLocationInput}
                  onChange={e => setVerifyLocationInput(e.target.value)}
                  placeholder="Pickup location"
                  className="w-full p-3 mb-4 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-1 focus:ring-black dark:focus:ring-gray-500 outline-none text-left"
                />
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleSaveVerifyLocation}
                    disabled={verifyLocationSaving || !verifyLocationInput.trim()}
                    className="px-5 py-2.5 bg-[#EAAD11] text-black font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {verifyLocationSaving ? 'Saving…' : 'Save location'}
                  </button>
                  <button
                    onClick={() => setVerifyState(null)}
                    className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                  >
                    Skip for now
                  </button>
                </div>
              </>
            )}

            {verifyState === 'confirmed' && verifyLocationSaved && (
              <>
                <h3 className="font-serif font-bold text-lg dark:text-white mb-2">All set!</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
                  Thanks — you're confirmed and your pickup location is saved.
                </p>
                <button
                  onClick={() => setVerifyState(null)}
                  className="px-5 py-2.5 bg-[#EAAD11] text-black font-bold rounded-xl hover:opacity-90 transition-all"
                >
                  Close
                </button>
              </>
            )}

            {(verifyState === 'expired' || verifyState === 'invalid') && (
              <>
                <h3 className="font-serif font-bold text-lg dark:text-white mb-2">{verifyModalContent.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">{verifyModalContent.body}</p>
                <button
                  onClick={() => setVerifyState(null)}
                  className="px-5 py-2.5 bg-[#EAAD11] text-black font-bold rounded-xl hover:opacity-90 transition-all"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {/* Hero banner */}
      <div className="relative h-44 md:h-60 bg-gray-200 dark:bg-gray-800 overflow-hidden">
        {vendorInfo?.banner_image ? (
          <img
            src={getImageSrc({ image_path: vendorInfo.banner_image, fallback_url: vendorInfo.banner_fallback_url }, 800)}
            alt="Vendor banner"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Camera className="w-12 h-12 text-gray-400 dark:text-gray-600" />
          </div>
        )}

        {isOwnProfile && (
          <>
            <input
              type="file"
              ref={bannerInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleBannerUpload}
            />
            <button
              onClick={() => bannerInputRef.current.click()}
              disabled={bannerUploading}
              title="Upload banner photo"
              className="absolute bottom-3 right-3 p-2.5 bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white rounded-full transition-all disabled:opacity-50"
            >
              {bannerUploading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="w-5 h-5" />
              )}
            </button>
          </>
        )}
      </div>

      {/* Vendor info block */}
      <div className="px-4 md:px-6 pt-5 pb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-tight text-gray-900 dark:text-white leading-tight flex items-center gap-2">
            {vendorInfo?.name || name}
            {vendorInfo?.is_premium && (
              <span className="inline-flex items-center gap-1 bg-[#EAAD11] text-black text-[11px] font-bold px-2 py-1 rounded-full normal-case tracking-normal">
                <Crown className="w-3 h-3" />
                Premium
              </span>
            )}
          </h1>
          {vendorInfo?.description && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{vendorInfo.description}</p>
          )}
          {!vendorInfo?.description && (
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{items.length} items</p>
          )}
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
            <div>
              <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">Bio</label>
              <textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                placeholder="Tell shoppers about your store..."
                rows={3}
                className="w-full p-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-1 focus:ring-black dark:focus:ring-gray-500 outline-none resize-none"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium dark:text-gray-300">
                  Pickup Location <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={locating}
                  className="flex items-center gap-1 text-xs font-semibold text-black dark:text-white hover:underline disabled:opacity-50"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {locating ? 'Locating…' : 'Use my location'}
                </button>
              </div>
              <input
                type="text"
                value={editLocation}
                onChange={e => setEditLocation(e.target.value)}
                required
                className="w-full p-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-1 focus:ring-black dark:focus:ring-gray-500 outline-none"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Needed so we can arrange item pickup for delivery.</p>
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

      {/* Tabs (own profile only — orders are private) */}
      {isOwnProfile && (
        <div className="px-4 md:px-6 mt-6 flex gap-2 border-b border-gray-100 dark:border-gray-800">
          {[{ key: 'items', label: 'My Items' }, { key: 'orders', label: 'Orders' }, { key: 'subscription', label: 'Subscription' }].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-[#EAAD11] text-gray-900 dark:text-white'
                  : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Product grid / Orders / Subscription */}
      <div className="px-4 md:px-6 mt-6">
        {isOwnProfile && activeTab === 'orders' ? (
          <VendorOrders />
        ) : isOwnProfile && activeTab === 'subscription' ? (
          <div className="max-w-md">
            {!subscriptionStatus ? (
              <ThrifterLoader />
            ) : (
              <>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    {subscriptionStatus.is_premium && <Crown className="w-4 h-4 text-[#EAAD11]" />}
                    <span className="font-bold text-gray-900 dark:text-white">
                      {subscriptionStatus.is_premium ? 'Premium plan' : 'Free plan'}
                    </span>
                    {subscriptionStatus.pending_payment && (
                      <span className="text-[11px] font-semibold text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">
                        Payment pending
                      </span>
                    )}
                  </div>
                  {subscriptionStatus.is_premium && subscriptionStatus.expires_at && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      Renews / expires {new Date(subscriptionStatus.expires_at).toLocaleDateString()}
                    </p>
                  )}
                  {subscriptionStatus.pending_payment && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      We're waiting on confirmation from your payment provider. This can take a minute — no need to pay again.
                    </p>
                  )}
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-gray-500 dark:text-gray-400">Active listings</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {subscriptionStatus.active_item_count}{subscriptionStatus.is_premium ? '' : ` / ${subscriptionStatus.free_item_limit}`}
                    </span>
                  </div>
                  {subscriptionStatus.hidden_item_count > 0 && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-500 dark:text-gray-400">Hidden (over limit)</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{subscriptionStatus.hidden_item_count}</span>
                    </div>
                  )}
                </div>
                {subscriptionStatus.pending_payment ? (
                  <button
                    onClick={refreshSubscriptionStatus}
                    disabled={refreshingSubscription}
                    className="w-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-3.5 rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {refreshingSubscription ? 'Checking…' : 'Check payment status'}
                  </button>
                ) : !subscriptionStatus.is_premium && (
                  <button
                    onClick={() => setShowUpgradeModal(true)}
                    className="w-full bg-[#EAAD11] text-black py-3.5 rounded-xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
                  >
                    <Crown className="w-4 h-4" />
                    Upgrade to Premium — {formatUGX(subscriptionStatus.price_ugx)}/30 days
                  </button>
                )}
              </>
            )}
          </div>
        ) : loading ? (
          <ThrifterLoader />
        ) : items.length > 0 ? (
          <MasonryGrid
            items={items}
            onItemClick={setSelectedItem}
            viewStats={isOwnProfile ? viewStats : null}
            hiddenBannerText={isOwnProfile ? 'Unavailable — upgrade to unlock' : undefined}
          />
        ) : (
          <div className="text-center py-20 text-gray-500">
            <p>No items from this vendor yet.</p>
          </div>
        )}
      </div>
      <UpgradeToPremiumModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </main>
  );
};

export default VendorPage;
