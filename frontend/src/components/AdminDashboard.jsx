import React, { useState, useEffect } from 'react';
import { Users, Store, Package, Heart, Trash2, ExternalLink, ToggleLeft, ToggleRight, Pin, PinOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import ThrifterLoader from './ThrifterLoader';

const AdminDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [promoEnabled, setPromoEnabled] = useState(false);
  const [promoToggling, setPromoToggling] = useState(false);

  useEffect(() => {
    if (!user?.is_admin) {
      navigate('/');
      return;
    }
    loadStats();
    loadVendors();
    loadFeatures();
  }, [user]);

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

  const loadItems = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/items');
      setItems(res.data);
    } catch (e) {
      console.error('Failed to load items', e);
    } finally {
      setLoading(false);
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

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'items' && items.length === 0) loadItems();
    if (tab === 'users' && users.length === 0) loadUsers();
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

  if (!user?.is_admin) return null;

  const tabs = ['overview', 'vendors', 'items', 'users'];

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
            </div>
          </div>
        </>
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
                          src={item.image_path}
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
