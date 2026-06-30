import React, { useState, useEffect, useRef } from 'react';
import { Users, Store, Package, Heart, Trash2, ExternalLink, ToggleLeft, ToggleRight, Pin, PinOff, Sparkles, ChevronRight, X, Edit3, Image as ImageIcon, ChevronLeft, Plus, Check, TrendingUp, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';
import ThrifterLoader from './ThrifterLoader';
import StyleModal from './StyleModal';

const AdminDashboard = ({ user, onOutfitBuilderClick }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [stylesSubTab, setStylesSubTab] = useState('curated'); // 'curated' or 'library'
  const [stats, setStats] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);
  const [itemsPage, setItemsPage] = useState(0);
  const [itemsHasMore, setItemsHasMore] = useState(true);
  const [itemsLoadingMore, setItemsLoadingMore] = useState(false);
  const [users, setUsers] = useState([]);
  const [styles, setStyles] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [clustersPage, setClustersPage] = useState(0);
  const [clustersHasMore, setClustersHasMore] = useState(false);
  const [clustersLoading, setClustersLoading] = useState(false);
  const [clustersLoadingMore, setClustersLoadingMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const ITEMS_PAGE_SIZE = 50;
  const CLUSTER_PAGE_SIZE = 20;
  const [promoEnabled, setPromoEnabled] = useState(false);
  const [promoToggling, setPromoToggling] = useState(false);
  const [pendingDemand, setPendingDemand] = useState([]);
  const [demandActionIds, setDemandActionIds] = useState(new Set());
  const [demandEntries, setDemandEntries] = useState([]);
  const [demandEntriesLoading, setDemandEntriesLoading] = useState(false);
  const [demandAdminEntry, setDemandAdminEntry] = useState(null);
  const [demandEditMode, setDemandEditMode] = useState(false);
  const [demandConfirmDelete, setDemandConfirmDelete] = useState(false);
  const [demandEditFields, setDemandEditFields] = useState({ item_name: '', price: '', description: '' });
  const [demandSaving, setDemandSaving] = useState(false);
  const [editingStyle, setEditingStyle] = useState(null);
  const [previewStyle, setPreviewStyle] = useState(null);
  const [previewCluster, setPreviewCluster] = useState(null);
  const [clusterPreviewItems, setClusterPreviewItems] = useState([]);
  const [loadingClusterPreview, setLoadingClusterPreview] = useState(false);
  const [createClusterOpen, setCreateClusterOpen] = useState(false);
  const [newClusterName, setNewClusterName] = useState('');
  const [pickerItems, setPickerItems] = useState([]);
  const [loadingPickerItems, setLoadingPickerItems] = useState(false);
  const [selectedPickerIds, setSelectedPickerIds] = useState(new Set());
  const [creatingCluster, setCreatingCluster] = useState(false);

  useEffect(() => {
    if (!user?.is_admin) {
      navigate('/');
      return;
    }
    loadStats();
    loadVendors();
    loadFeatures();
    loadPendingDemand();
  }, [user]);

  useEffect(() => {
    if (activeTab === 'items' && items.length === 0) loadItems();
    if (activeTab === 'users' && users.length === 0) loadUsers();
    if (activeTab === 'styles') {
      if (styles.length === 0) loadStyles();
      if (clusters.length === 0) loadClusters();
    }
    if (activeTab === 'polls') {
      loadPendingDemand();
      if (demandEntries.length === 0) loadDemandEntries();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!createClusterOpen) return;
    setSelectedPickerIds(new Set());
    const fetchPickerItems = async () => {
      setLoadingPickerItems(true);
      try {
        const res = await api.get('/wardrobe');
        setPickerItems(res.data);
      } catch (e) {
        console.error('Failed to load wardrobe items for picker', e);
      } finally {
        setLoadingPickerItems(false);
      }
    };
    fetchPickerItems();
  }, [createClusterOpen]);

  const openDemandAdminPanel = (entry) => {
    setDemandAdminEntry(entry);
    setDemandEditFields({ item_name: entry.item_name, price: entry.price, description: entry.description || '' });
    setDemandEditMode(false);
    setDemandConfirmDelete(false);
  };

  const closeDemandAdminPanel = () => {
    setDemandAdminEntry(null);
    setDemandEditMode(false);
    setDemandConfirmDelete(false);
    setDemandSaving(false);
  };

  const handleDemandEdit = async () => {
    setDemandSaving(true);
    try {
      await api.patch(`/admin/demand/${demandAdminEntry.id}`, {
        item_name: demandEditFields.item_name.trim(),
        price: demandEditFields.price.trim(),
        description: demandEditFields.description.trim() || null,
      });
      setDemandEntries(prev => prev.map(e =>
        e.id === demandAdminEntry.id
          ? { ...e, item_name: demandEditFields.item_name.trim(), price: demandEditFields.price.trim(), description: demandEditFields.description.trim() || null }
          : e
      ));
      closeDemandAdminPanel();
    } catch (e) {
      alert(e?.response?.data?.detail || 'Failed to save changes.');
    } finally {
      setDemandSaving(false);
    }
  };

  const handleDemandDelete = async () => {
    setDemandSaving(true);
    try {
      await api.delete(`/admin/demand/${demandAdminEntry.id}`);
      setDemandEntries(prev => prev.filter(e => e.id !== demandAdminEntry.id));
      closeDemandAdminPanel();
    } catch (e) {
      alert(e?.response?.data?.detail || 'Failed to delete entry.');
    } finally {
      setDemandSaving(false);
    }
  };

  const loadDemandEntries = async () => {
    setDemandEntriesLoading(true);
    try {
      const res = await api.get('/demand');
      setDemandEntries(res.data);
    } catch (e) {
      console.error('Failed to load demand entries', e);
    } finally {
      setDemandEntriesLoading(false);
    }
  };

  const loadPendingDemand = async () => {
    try {
      const res = await api.get('/admin/demand/pending');
      setPendingDemand(res.data);
    } catch (e) {
      console.error('Failed to load pending demand entries', e);
    }
  };

  const handleDemandAction = async (id, status) => {
    setDemandActionIds(prev => new Set([...prev, id]));
    try {
      await api.patch(`/admin/demand/${id}/status`, { status });
      setPendingDemand(prev => prev.filter(e => e.id !== id));
    } catch (e) {
      console.error('Failed to update demand entry', e);
    } finally {
      setDemandActionIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const loadFeatures = async () => {
    try {
      const res = await api.get('/features');
      setPromoEnabled(res.data.promo_10k_enabled ?? false);
    } catch (e) {
      console.error('Failed to load features', e);
    }
  };

  const loadStats = async () => {
    try {
      const res = await api.get('/admin/stats');
      setStats(res.data);
    } catch (e) {
      console.error('Failed to load stats', e);
    }
  };

  const loadVendors = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/vendors');
      setVendors(res.data);
    } catch (e) {
      console.error('Failed to load vendors', e);
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async (page = 0) => {
    page === 0 ? setLoading(true) : setItemsLoadingMore(true);
    try {
      const res = await api.get(`/admin/items?skip=${page * ITEMS_PAGE_SIZE}&limit=${ITEMS_PAGE_SIZE}`);
      setItems(prev => page === 0 ? res.data : [...prev, ...res.data]);
      setItemsPage(page);
      setItemsHasMore(res.data.length === ITEMS_PAGE_SIZE);
    } catch (e) {
      console.error('Failed to load items', e);
    } finally {
      setLoading(false);
      setItemsLoadingMore(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data);
    } catch (e) {
      console.error('Failed to load users', e);
    } finally {
      setLoading(false);
    }
  };

  const loadStyles = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/outfit-styles');
      setStyles(res.data);
    } catch (e) {
      console.error('Failed to load styles', e);
    } finally {
      setLoading(false);
    }
  };

  const loadClusters = async (page = 0) => {
    page === 0 ? setClustersLoading(true) : setClustersLoadingMore(true);
    try {
      const res = await api.get(`/admin/visual-clusters?skip=${page * CLUSTER_PAGE_SIZE}&limit=${CLUSTER_PAGE_SIZE}`);
      setClusters(prev => page === 0 ? res.data : [...prev, ...res.data]);
      setClustersPage(page);
      setClustersHasMore(res.data.length === CLUSTER_PAGE_SIZE);
    } catch (e) {
      console.error('Failed to load clusters', e);
    } finally {
      setClustersLoading(false);
      setClustersLoadingMore(false);
    }
  };

  const [discoveryLoading, setDiscoveryLoading] = useState(false);

  const runDiscovery = async () => {
    setDiscoveryLoading(true);
    try {
      await api.post('/admin/outfit-styles/discover');
      alert('AI Style Discovery started! Refresh in a few seconds to see new pending clusters.');
      loadClusters();
    } catch (e) {
      alert('Failed to start discovery: ' + (e.response?.data?.detail || e.message));
    } finally {
      setDiscoveryLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'items' && items.length === 0) loadItems();
    if (tab === 'users' && users.length === 0) loadUsers();
    if (tab === 'styles') {
      if (styles.length === 0) loadStyles();
      if (clusters.length === 0) loadClusters();
    }
  };

  const handleApproveStyle = async (id, data) => {
    try {
      if (id) {
        // Update existing style
        const res = await api.post(`/admin/outfit-styles/${id}/approve`, data);
        setStyles(prev => prev.map(s => s.id === id ? res.data : s));
      } else {
        // Create new style
        const res = await api.post('/admin/outfit-styles/create', data);
        setStyles(prev => [res.data, ...prev]);
      }
      setEditingStyle(null);
    } catch (e) {
      alert('Failed to save style: ' + (e.response?.data?.detail || e.message));
    }
  };

  const handleCreateCluster = async () => {
    if (!newClusterName.trim()) return;
    const ids = [...selectedPickerIds];
    if (ids.length === 0) {
      alert('Select at least one item to seed the pool');
      return;
    }
    setCreatingCluster(true);
    try {
      const res = await api.post('/admin/visual-clusters/create', { name: newClusterName.trim(), item_ids: ids });
      setClusters(prev => [res.data, ...prev]);
      setCreateClusterOpen(false);
      setNewClusterName('');
      setSelectedPickerIds(new Set());
    } catch (e) {
      alert('Failed to create cluster: ' + (e.response?.data?.detail || e.message));
    } finally {
      setCreatingCluster(false);
    }
  };

  const togglePickerItem = (id) => {
    setSelectedPickerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUpdateCluster = async (id, customName) => {
    try {
      const res = await api.patch(`/admin/visual-clusters/${id}`, { custom_name: customName });
      setClusters(prev => prev.map(c => c.id === id ? res.data : c));
      setPreviewCluster(prev => prev?.id === id ? res.data : prev);
    } catch (e) {
      alert('Failed to update cluster: ' + (e.response?.data?.detail || e.message));
    }
  };

  const openClusterPreview = async (cluster) => {
    setPreviewCluster(cluster);
    setLoadingClusterPreview(true);
    try {
      const res = await api.get(`/admin/visual-clusters/${cluster.id}/items`);
      setClusterPreviewItems(res.data);
    } catch (e) {
      console.error('Failed to load cluster items', e);
    } finally {
      setLoadingClusterPreview(false);
    }
  };

  const handleDeleteStyle = async (id) => {
    if (!window.confirm('Permanently delete this aesthetic? This cannot be undone.')) return;
    try {
      await api.delete(`/admin/outfit-styles/${id}`);
      setStyles(prev => prev.filter(s => s.id !== id));
      setEditingStyle(null);
    } catch (e) {
      alert('Failed to delete style: ' + (e.response?.data?.detail || e.message));
    }
  };

  const toggleVendor = async (vendorId) => {
    try {
      const res = await api.patch(`/admin/vendors/${vendorId}/toggle`);
      setVendors(prev => prev.map(v => v.id === vendorId ? res.data : v));
      loadStats();
    } catch (e) {
      alert('Failed to update vendor: ' + (e.response?.data?.detail || e.message));
    }
  };

  const pinVendor = async (vendorId) => {
    try {
      const res = await api.patch(`/admin/vendors/${vendorId}/pin`);
      setVendors(prev => {
        const updated = prev.map(v => v.id === vendorId ? res.data : v);
        return [...updated].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));
      });
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to update pin');
    }
  };

  const togglePromo = async () => {
    setPromoToggling(true);
    try {
      const res = await api.patch('/admin/features/promo_10k');
      setPromoEnabled(res.data.promo_10k_enabled);
    } catch (e) {
      alert('Failed to toggle promotion: ' + (e.response?.data?.detail || e.message));
    } finally {
      setPromoToggling(false);
    }
  };

  const deleteItem = async (itemId) => {
    if (!window.confirm('Permanently delete this item? This cannot be undone.')) return;
    try {
      await api.delete(`/admin/items/${itemId}`);
      setItems(prev => prev.filter(i => i.id !== itemId));
      loadStats();
    } catch (e) {
      alert('Failed to delete item: ' + (e.response?.data?.detail || e.message));
    }
  };

  const getImageUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const base = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
    const filename = path.split(/[\\/]/).pop();
    return `${base}/images/${filename}`;
  };

  const cloudinaryResize = (url, w, h) => {
    if (!url || !url.includes('cloudinary.com/')) return url;
    return url.replace('/upload/', `/upload/w_${w},h_${h},c_fill,q_70/`);
  };

  if (!user?.is_admin) return null;

  const tabs = ['overview', 'polls', 'vendors', 'items', 'users', 'styles'];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Manage the Thrifter platform</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-8 overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`px-5 py-3 text-sm font-medium capitalize whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-black dark:border-white text-black dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <>
          {stats ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              <StatCard icon={<Users />} label="Total Users" value={stats.total_users} />
              <StatCard icon={<Store />} label="Total Vendors" value={stats.total_vendors} />
              <StatCard icon={<Package />} label="Total Items" value={stats.total_items} />
              <StatCard icon={<Heart />} label="Wardrobe Saves" value={stats.total_wardrobe_saves} />
              <StatCard icon={<Store />} label="Active Vendors" value={stats.active_vendors} color="green" />
              <StatCard icon={<Store />} label="Hidden Vendors" value={stats.inactive_vendors} color="red" />
            </div>
          ) : <ThrifterLoader />}

          <div>
            <h2 className="text-base font-bold mb-4">Site Settings</h2>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium">10k Promotion Tab</p>
                  <p className="text-xs text-gray-400 mt-0.5">Shows a feed of items priced at 10,000 UGX or under</p>
                </div>
                <button
                  onClick={togglePromo}
                  disabled={promoToggling}
                  className={`flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-medium transition-colors ${
                    promoEnabled
                      ? 'bg-[#EAAD11] text-black hover:opacity-90'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  } disabled:opacity-50`}
                >
                  {promoEnabled
                    ? <><ToggleRight className="w-4 h-4" /> On</>
                    : <><ToggleLeft className="w-4 h-4" /> Off</>
                  }
                </button>
              </div>
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium">Outfit Builder</p>
                  <p className="text-xs text-gray-400 mt-0.5">Explore AI-discovered style aesthetics and curated item pools</p>
                </div>
                <button
                  onClick={onOutfitBuilderClick}
                  className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-medium bg-[#EAAD11] text-black hover:opacity-90 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Launch
                </button>
              </div>
            </div>
          </div>

        </>
      )}

      {/* Polls Tab */}
      {activeTab === 'polls' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Pending Requests</h2>
              <p className="text-xs text-gray-400 mt-0.5">Approve or reject community item requests before they go live</p>
            </div>
            <button
              onClick={() => navigate('/demand-board')}
              className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
              View Board
            </button>
          </div>
          {pendingDemand.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="font-medium">No pending requests</p>
              <p className="text-sm mt-1">New submissions will appear here for review</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
              {pendingDemand.map(entry => (
                <div key={entry.id} className="px-6 py-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{entry.item_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{entry.price}</p>
                    {entry.description && (
                      <p className="text-xs text-gray-400 mt-0.5">{entry.description}</p>
                    )}
                    {entry.submitter_email && (
                      <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">{entry.submitter_email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDemandAction(entry.id, 'approved')}
                      disabled={demandActionIds.has(entry.id)}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 hover:opacity-80 transition-opacity disabled:opacity-40"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleDemandAction(entry.id, 'rejected')}
                      disabled={demandActionIds.has(entry.id)}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 hover:opacity-80 transition-opacity disabled:opacity-40"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Live Board</h2>
                <p className="text-xs text-gray-400 mt-0.5">Current rankings by score</p>
              </div>
              <button
                onClick={loadDemandEntries}
                disabled={demandEntriesLoading}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                {demandEntriesLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            {demandEntriesLoading ? (
              <ThrifterLoader />
            ) : demandEntries.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-sm">No approved entries yet</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
                {demandEntries.map((entry, i) => (
                  <div
                    key={entry.id}
                    onClick={() => openDemandAdminPanel(entry)}
                    className="px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <span className="text-xs font-bold text-gray-300 dark:text-gray-600 w-5 shrink-0 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{entry.item_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{entry.price}</p>
                      {entry.description && (
                        <p className="text-xs text-gray-400 mt-0.5">{entry.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-xs">
                      <span className="text-green-600 dark:text-green-400 font-medium">▲ {entry.upvotes}</span>
                      <span className="text-red-500 dark:text-red-400 font-medium">▼ {entry.downvotes}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stylist Studio (Styles Tab) */}
      {activeTab === 'styles' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-serif font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#EAAD11]" />
                Stylist Studio
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Curate AI visual pools into beautiful aesthetics</p>
            </div>
            
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl self-start">
              <button
                onClick={() => setStylesSubTab('curated')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  stylesSubTab === 'curated'
                    ? 'bg-white dark:bg-gray-700 shadow-sm text-black dark:text-white'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Curated Styles
              </button>
              <button
                onClick={() => setStylesSubTab('library')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  stylesSubTab === 'library'
                    ? 'bg-white dark:bg-gray-700 shadow-sm text-black dark:text-white'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Cluster Library
              </button>
            </div>
          </div>

          {stylesSubTab === 'library' ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">Visual Pools ({clusters.length})</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCreateClusterOpen(true)}
                    className="flex items-center gap-2 bg-[#EAAD11] text-black px-4 py-2 rounded-xl font-bold text-xs hover:opacity-90 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Create Manual Pool
                  </button>
                  <button
                    onClick={runDiscovery}
                    disabled={discoveryLoading}
                    className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-xl font-bold text-xs hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {discoveryLoading ? 'Discovery Running...' : 'Refresh AI Discovery'}
                  </button>
                </div>
              </div>

              {clustersLoading ? <ThrifterLoader /> : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {clusters.map((cluster) => {
                      const sampleIds = JSON.parse(cluster.sample_item_ids || '[]');
                      return (
                        <div
                          key={cluster.id}
                          onClick={() => openClusterPreview(cluster)}
                          className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 hover:border-[#EAAD11] transition-all cursor-pointer group shadow-sm"
                        >
                          <div className="flex gap-1 h-20 mb-3 overflow-hidden rounded-lg opacity-80 group-hover:opacity-100 transition-opacity">
                            {sampleIds.slice(0, 3).map((id, idx) => (
                              <div key={idx} className="flex-1 bg-gray-50 dark:bg-gray-900">
                                  <img
                                    src={`${import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')}/api/items/${id}/image?w=80`}
                                    alt="preview"
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    onError={(e) => { e.target.src = '/placeholder.svg' }}
                                  />
                              </div>
                            ))}
                          </div>
                          <h4 className="font-bold text-sm line-clamp-1">{cluster.custom_name || cluster.ai_label}</h4>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-gray-400 font-mono italic">AI: {cluster.ai_label}</span>
                            {cluster.custom_name && <Edit3 className="w-3 h-3 text-[#EAAD11]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {clustersHasMore && (
                    <div className="flex justify-center mt-4">
                      <button
                        onClick={() => loadClusters(clustersPage + 1)}
                        disabled={clustersLoadingMore}
                        className="px-6 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                      >
                        {clustersLoadingMore ? 'Loading...' : 'Load more'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[600px]">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 font-medium">
                  <tr>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Aesthetic Name</th>
                    <th className="px-6 py-4">Composition</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {styles.map((style) => (
                    <tr key={style.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer group" onClick={() => setPreviewStyle(style)}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-10 bg-gray-50 dark:bg-gray-900 rounded-md overflow-hidden shrink-0 border border-gray-100 dark:border-gray-800">
                            {style.cover_image_path ? (
                              <img src={style.cover_image_path} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <ImageIcon className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          {style.is_approved ? (
                            <span className="px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-full text-[10px] font-bold uppercase tracking-wider">Live</span>
                          ) : (
                            <span className="px-2 py-1 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-full text-[10px] font-bold uppercase tracking-wider">Draft</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold group-hover:text-[#EAAD11] transition-colors">{style.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">/{style.slug}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${style.top_cluster ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'}`}>Tops</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] ${style.bottom_cluster ? 'bg-purple-50 text-purple-600' : 'bg-gray-50 text-gray-400'}`}>Bottoms</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => setEditingStyle({...style})}
                          className="text-[#EAAD11] font-bold hover:underline"
                        >
                          {style.is_approved ? 'Edit' : 'Review'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td colSpan="4" className="px-6 py-6 text-center">
                      <button 
                        onClick={() => setEditingStyle({ name: '', slug: '', description: '', is_approved: false, sample_item_ids: '[]' })}
                        className="inline-flex items-center gap-2 text-[#EAAD11] font-bold hover:opacity-80"
                      >
                        <Plus className="w-4 h-4" />
                        Create New Aesthetic
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Cluster Horizontal Preview Modal */}
      <AnimatePresence>
        {previewCluster && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-10">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md" 
              onClick={() => setPreviewCluster(null)} 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-5xl bg-white dark:bg-gray-900 rounded-[2.5rem] overflow-hidden flex flex-col max-h-[85vh] shadow-2xl"
            >
              {/* Header */}
              <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <input 
                      type="text"
                      className="text-2xl font-serif font-bold bg-transparent border-none focus:ring-0 p-0 hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors w-full"
                      defaultValue={previewCluster.custom_name || previewCluster.ai_label}
                      placeholder="Give this pool a name..."
                      onBlur={(e) => handleUpdateCluster(previewCluster.id, e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">
                    AI Identity: {previewCluster.ai_label} • {clusterPreviewItems.length} items matched
                  </p>
                </div>
                <button onClick={() => setPreviewCluster(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Horizontal Scroll Content */}
              <div className="flex-1 overflow-x-auto overflow-y-hidden no-scrollbar flex items-center p-8 gap-6 bg-gray-50/50 dark:bg-gray-950/50">
                {loadingClusterPreview ? (
                  <div className="w-full flex justify-center py-20"><ThrifterLoader /></div>
                ) : (
                  clusterPreviewItems.map((item, idx) => (
                    <motion.div 
                      key={item.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex-shrink-0 w-64 h-[400px] bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg border border-gray-100 dark:border-gray-700 flex flex-col group"
                    >
                      <img
                        src={cloudinaryResize(getImageUrl(item.image_path), 512, 800)}
                        alt={item.name}
                        className="w-full flex-1 object-cover"
                        loading="lazy"
                      />
                      <div className="p-4">
                        <p className="font-bold text-sm line-clamp-1">{item.name}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-tighter">{item.item_type} • {item.size}</p>
                        <p className="text-[10px] text-gray-400 font-mono mt-1">ID: {item.id}</p>
                      </div>
                    </motion.div>
                  ))
                )}
                <div className="flex-shrink-0 w-20 h-full" /> {/* Spacer */}
              </div>

              {/* Footer Actions */}
              <div className="p-6 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
                 <button 
                  onClick={() => setPreviewCluster(null)}
                  className="px-8 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold hover:opacity-90 transition-all shadow-xl"
                >
                  Save & Back
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Style Modal / Composer */}
      {editingStyle && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingStyle(null)} />
          <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="text-2xl font-serif font-bold mb-8">Aesthetic Composer</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Basic Details */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#EAAD11]">1. Storytelling</h4>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Display Name</label>
                  <input 
                    type="text" 
                    value={editingStyle.name}
                    onChange={(e) => setEditingStyle({...editingStyle, name: e.target.value})}
                    placeholder="e.g. Vintage Grunge"
                    className="w-full bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 focus:ring-2 ring-[#EAAD11] transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Slug (URL)</label>
                  <input 
                    type="text" 
                    value={editingStyle.slug}
                    onChange={(e) => setEditingStyle({...editingStyle, slug: e.target.value})}
                    placeholder="vintage-grunge"
                    className="w-full bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 focus:ring-2 ring-[#EAAD11] transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Description</label>
                  <textarea 
                    value={editingStyle.description}
                    onChange={(e) => setEditingStyle({...editingStyle, description: e.target.value})}
                    rows={3}
                    placeholder="Describe the vibe of this aesthetic..."
                    className="w-full bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 focus:ring-2 ring-[#EAAD11] transition-all outline-none"
                  />
                </div>
              </div>

              {/* Cluster Composition */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#EAAD11]">2. Visual Pools</h4>
                
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Tops Pool</label>
                  <select 
                    value={editingStyle.top_cluster_id || ''}
                    onChange={(e) => setEditingStyle({...editingStyle, top_cluster_id: e.target.value ? parseInt(e.target.value) : null})}
                    className="w-full bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 focus:ring-2 ring-[#EAAD11] outline-none"
                  >
                    <option value="">(Not Set)</option>
                    {clusters.map(c => <option key={c.id} value={c.id}>{c.custom_name || c.ai_label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Bottoms Pool</label>
                  <select 
                    value={editingStyle.bottom_cluster_id || ''}
                    onChange={(e) => setEditingStyle({...editingStyle, bottom_cluster_id: e.target.value ? parseInt(e.target.value) : null})}
                    className="w-full bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 focus:ring-2 ring-[#EAAD11] outline-none"
                  >
                    <option value="">(Not Set)</option>
                    {clusters.map(c => <option key={c.id} value={c.id}>{c.custom_name || c.ai_label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Accessories Pool</label>
                  <select 
                    value={editingStyle.accessory_cluster_id || ''}
                    onChange={(e) => setEditingStyle({...editingStyle, accessory_cluster_id: e.target.value ? parseInt(e.target.value) : null})}
                    className="w-full bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 focus:ring-2 ring-[#EAAD11] outline-none"
                  >
                    <option value="">(Not Set)</option>
                    {clusters.map(c => <option key={c.id} value={c.id}>{c.custom_name || c.ai_label}</option>)}
                  </select>
                </div>

                <div className="pt-2 border-t border-gray-50 dark:border-gray-800">
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-2 italic">Custom Aesthetic Cover</label>
                  <div className="flex items-center gap-4">
                    {editingStyle.cover_image_path ? (
                      <div className="relative w-20 h-24 rounded-lg overflow-hidden border border-gray-100">
                        <img src={editingStyle.cover_image_path} alt="cover" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => setEditingStyle({...editingStyle, cover_image_path: null, cover_cloudinary_id: null})}
                          className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full hover:bg-black"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="w-20 h-24 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-[#EAAD11] transition-all group">
                        <Plus className="w-5 h-5 text-gray-300 group-hover:text-[#EAAD11]" />
                        <span className="text-[8px] text-gray-400 font-bold uppercase mt-1">Upload</span>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            const formData = new FormData();
                            formData.append('file', file);
                            try {
                              const res = await api.post('/admin/outfit-styles/upload-cover', formData);
                              setEditingStyle({
                                ...editingStyle, 
                                cover_image_path: res.data.image_path,
                                cover_cloudinary_id: res.data.cloudinary_public_id
                              });
                            } catch (err) {
                              alert('Upload failed: ' + err.message);
                            }
                          }}
                        />
                      </label>
                    )}
                    <div className="flex-1">
                      <p className="text-[10px] text-gray-400 leading-tight">This image will be shown as the main card on the Outfit Builder page. If empty, item previews will be used instead.</p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-50 dark:border-gray-800">
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1 italic">Preview Item IDs (Legacy) (Optional)</label>
                  <input
 
                    type="text" 
                    value={editingStyle.sample_item_ids}
                    onChange={(e) => setEditingStyle({...editingStyle, sample_item_ids: e.target.value})}
                    placeholder="[1, 2, 3]"
                    className="w-full bg-gray-50 dark:bg-gray-800 p-2 text-xs rounded-xl border border-gray-100 dark:border-gray-700 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="mt-10 flex gap-3">
              <button 
                onClick={() => handleApproveStyle(editingStyle.id, editingStyle)}
                className="flex-1 bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg"
              >
                {editingStyle.id ? 'Save Changes & Go Live' : 'Create Aesthetic'}
              </button>
              {editingStyle.id ? (
                <button 
                  onClick={() => handleDeleteStyle(editingStyle.id)}
                  className="px-8 py-4 text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all"
                >
                  Delete Aesthetic
                </button>
              ) : (
                <button 
                  onClick={() => setEditingStyle(null)}
                  className="px-8 py-4 text-gray-500 font-medium hover:text-black dark:hover:text-white transition-all"
                >
                  Discard
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Vendors */}
      {activeTab === 'vendors' && (
        loading ? <ThrifterLoader /> : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400">
                {vendors.filter(v => v.is_pinned).length}/5 vendors pinned
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-x-auto">
              <table className="w-full text-sm min-w-[680px]">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600">
                  <tr>
                    <th className="text-left px-6 py-3 font-medium text-gray-500">Vendor</th>
                    <th className="text-left px-6 py-3 font-medium text-gray-500">WhatsApp</th>
                    <th className="text-left px-6 py-3 font-medium text-gray-500">Items</th>
                    <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
                    <th className="text-left px-6 py-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {vendors.map(vendor => (
                    <tr key={vendor.id} className={`hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors ${vendor.is_pinned ? 'bg-amber-50/40 dark:bg-amber-900/20' : ''}`}>
                      <td className="px-6 py-4 font-medium">
                        <Link
                          to={`/vendor/${encodeURIComponent(vendor.name)}`}
                          className="hover:underline flex items-center gap-1.5"
                        >
                          {vendor.is_pinned && <Pin className="w-3 h-3 text-[#EAAD11] shrink-0" />}
                          {vendor.name}
                          <ExternalLink className="w-3 h-3 text-gray-400 shrink-0" />
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-gray-500">{vendor.whatsapp || '—'}</td>
                      <td className="px-6 py-4 text-gray-500">{vendor.item_count}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          vendor.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {vendor.is_active ? 'Visible' : 'Hidden'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleVendor(vendor.id)}
                            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                              vendor.is_active
                                ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                : 'bg-green-50 text-green-700 hover:bg-green-100'
                            }`}
                          >
                            {vendor.is_active
                              ? <><ToggleRight className="w-4 h-4" /> Hide</>
                              : <><ToggleLeft className="w-4 h-4" /> Show</>
                            }
                          </button>
                          <button
                            onClick={() => pinVendor(vendor.id)}
                            title={vendor.is_pinned ? 'Unpin vendor' : 'Pin vendor to top'}
                            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                              vendor.is_pinned
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            {vendor.is_pinned
                              ? <><PinOff className="w-3.5 h-3.5" /> Unpin</>
                              : <><Pin className="w-3.5 h-3.5" /> Pin</>
                            }
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {vendors.length === 0 && (
                <p className="text-center py-12 text-gray-400 text-sm">No vendors found.</p>
              )}
            </div>
          </div>
        )
      )}

      {/* Items */}
      {activeTab === 'items' && (
        loading ? <ThrifterLoader /> : (
          <>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Item</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Vendor</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Price</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Category</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={getImageUrl(item.image_path)}
                          alt={item.name}
                          className="w-10 h-12 object-cover rounded-lg bg-gray-100 dark:bg-gray-700 shrink-0"
                        />
                        <span className="font-medium line-clamp-1">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-gray-500">
                      {item.vendor_name ? (
                        <Link
                          to={`/vendor/${encodeURIComponent(item.vendor_name)}`}
                          className="hover:underline"
                        >
                          {item.vendor_name}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-3 text-gray-500">
                      UGX {Number(item.price).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-gray-500 capitalize">
                      {item.item_type || '—'}
                    </td>
                    <td className="px-6 py-3">
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && (
              <p className="text-center py-12 text-gray-400 text-sm">No items found.</p>
            )}
          </div>
          {itemsHasMore && (
            <div className="flex justify-center mt-4">
              <button
                onClick={() => loadItems(itemsPage + 1)}
                disabled={itemsLoadingMore}
                className="px-6 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {itemsLoadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
          </>
        )
      )}

      {/* Users */}
      {activeTab === 'users' && (
        loading ? <ThrifterLoader /> : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Email</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Role</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Vendor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 font-medium">{u.email}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {u.is_admin && <Badge color="purple" label="Admin" />}
                        {u.is_vendor && <Badge color="blue" label="Vendor" />}
                        {!u.is_admin && !u.is_vendor && <Badge color="gray" label="User" />}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {u.vendor_name ? (
                        <Link
                          to={`/vendor/${encodeURIComponent(u.vendor_name)}`}
                          className="hover:underline flex items-center gap-1"
                        >
                          {u.vendor_name}
                          <ExternalLink className="w-3 h-3 text-gray-400 shrink-0" />
                        </Link>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <p className="text-center py-12 text-gray-400 text-sm">No users found.</p>
            )}
          </div>
        )
      )}

      {/* Create Manual Cluster Modal */}
      <AnimatePresence>
        {createClusterOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setCreateClusterOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-8 pb-4">
                <h3 className="text-xl font-serif font-bold mb-1">Create Manual Pool</h3>
                <p className="text-xs text-gray-400">Select items from your wardrobe — their embeddings will be averaged to define this pool's visual identity.</p>
              </div>

              {/* Name input */}
              <div className="px-8 pb-4">
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Pool Name</label>
                <input
                  type="text"
                  value={newClusterName}
                  onChange={(e) => setNewClusterName(e.target.value)}
                  placeholder="e.g. Elegant Evening Tops"
                  className="w-full bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 focus:ring-2 ring-[#EAAD11] transition-all outline-none"
                />
              </div>

              {/* Item picker grid */}
              <div className="flex-1 overflow-y-auto px-8 pb-4 min-h-0">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">
                    Wardrobe Items — Tap to Select
                  </label>
                  {selectedPickerIds.size > 0 && (
                    <span className="text-[10px] font-bold text-[#EAAD11] uppercase tracking-wider">{selectedPickerIds.size} selected</span>
                  )}
                </div>

                {loadingPickerItems ? (
                  <div className="flex justify-center py-12"><ThrifterLoader /></div>
                ) : pickerItems.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 italic text-sm">
                    Your wardrobe is empty — save some items first to use them as seeds.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                    {pickerItems.map((item) => {
                      const selected = selectedPickerIds.has(item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => togglePickerItem(item.id)}
                          className={`relative rounded-2xl overflow-hidden aspect-[3/4] group transition-all ${
                            selected
                              ? 'ring-2 ring-[#EAAD11] scale-[0.97]'
                              : 'ring-1 ring-gray-100 dark:ring-gray-800 hover:ring-[#EAAD11]/50'
                          }`}
                        >
                          <img
                            src={getImageUrl(item.image_path)}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.src = '/placeholder.svg'; }}
                          />
                          {/* Selection overlay */}
                          {selected && (
                            <div className="absolute inset-0 bg-[#EAAD11]/20 flex items-center justify-center">
                              <div className="bg-[#EAAD11] rounded-full p-1">
                                <Check className="w-4 h-4 text-black" />
                              </div>
                            </div>
                          )}
                          {/* Name tooltip on hover */}
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-white text-[10px] font-medium line-clamp-1">{item.name}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-8 pt-4 border-t border-gray-100 dark:border-gray-800 flex gap-3">
                <button
                  onClick={handleCreateCluster}
                  disabled={creatingCluster || !newClusterName.trim() || selectedPickerIds.size === 0}
                  className="flex-1 bg-black dark:bg-white text-white dark:text-black py-3 rounded-2xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-40"
                >
                  {creatingCluster ? 'Creating...' : `Create Pool${selectedPickerIds.size > 0 ? ` (${selectedPickerIds.size} items)` : ''}`}
                </button>
                <button
                  onClick={() => setCreateClusterOpen(false)}
                  className="px-6 py-3 text-gray-500 font-medium hover:text-black dark:hover:text-white transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {previewStyle && (
        <StyleModal
          style={previewStyle}
          onClose={() => setPreviewStyle(null)}
          onBuild={(style) => {
            // Navigate to outfit builder and pass the style to auto-start the builder
            navigate('/outfit-builder', { state: { autoBuildStyle: style } });
          }}
        />
      )}
      {/* Demand entry admin panel */}
      <AnimatePresence>
        {demandAdminEntry && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={closeDemandAdminPanel}
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="relative w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl p-6 z-10"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  {demandEditMode ? 'Edit Entry' : demandConfirmDelete ? 'Delete Entry' : 'Manage Entry'}
                </h2>
                <button onClick={closeDemandAdminPanel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {demandConfirmDelete ? (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Are you sure you want to delete this entry?</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-5">"{demandAdminEntry.item_name}"</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDemandConfirmDelete(false)}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDemandDelete}
                      disabled={demandSaving}
                      className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40"
                    >
                      {demandSaving ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ) : demandEditMode ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Item Name</label>
                    <input
                      value={demandEditFields.item_name}
                      onChange={e => setDemandEditFields(f => ({ ...f, item_name: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Price</label>
                    <input
                      value={demandEditFields.price}
                      onChange={e => setDemandEditFields(f => ({ ...f, price: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Description</label>
                    <textarea
                      value={demandEditFields.description}
                      onChange={e => setDemandEditFields(f => ({ ...f, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white resize-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDemandEditMode(false)}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleDemandEdit}
                      disabled={demandSaving || !demandEditFields.item_name.trim() || !demandEditFields.price.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40"
                    >
                      {demandSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-5">
                    <p className="font-semibold text-gray-900 dark:text-white">{demandAdminEntry.item_name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{demandAdminEntry.price}</p>
                    {demandAdminEntry.description && (
                      <p className="text-sm text-gray-400 mt-1">{demandAdminEntry.description}</p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDemandEditMode(true)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => setDemandConfirmDelete(true)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium hover:opacity-80 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const StatCard = ({ icon, label, value, color }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${
      color === 'green' ? 'bg-green-50 text-green-600' :
      color === 'red'   ? 'bg-red-50 text-red-600' :
                          'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
    }`}>
      {React.cloneElement(icon, { className: 'w-5 h-5' })}
    </div>
    <p className="text-2xl font-bold">{Number(value).toLocaleString()}</p>
    <p className="text-sm text-gray-500 mt-1">{label}</p>
  </div>
);

const Badge = ({ color, label }) => {
  const styles = {
    purple: 'bg-purple-50 text-purple-700',
    blue:   'bg-blue-50 text-blue-700',
    gray:   'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[color]}`}>
      {label}
    </span>
  );
};

export default AdminDashboard;
