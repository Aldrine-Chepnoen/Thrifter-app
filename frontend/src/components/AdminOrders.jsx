import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchAdminOrders, updateAdminOrderStatus } from '../api';
import { getImageSrc } from '../utils';
import { Link } from 'react-router-dom';
import ThrifterLoader from './ThrifterLoader';

const formatUGX = (n) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
};

const formatDate = (d) => new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' });

const STATUS_STYLES = {
  paid: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  picked_up: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  delivered: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};

const STATUS_LABELS = { paid: 'Order placed', picked_up: 'On delivery', delivered: 'Delivered' };
const NEXT_STATUS = { paid: 'picked_up', picked_up: 'delivered' };
const NEXT_LABEL = { paid: 'Mark Picked Up', picked_up: 'Mark Delivered' };

// Groups pickups/deliveries by area so a run can be planned without manually
// re-sorting — orders with no location on file sort last, not first.
const byLocation = (key) => (a, b) => {
  const av = (a[key] || '').trim();
  const bv = (b[key] || '').trim();
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  return av.localeCompare(bv);
};

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [section, setSection] = useState('pending'); // 'pending' | 'complete'
  const [updatingId, setUpdatingId] = useState(null);

  const loadOrders = ({ silent } = {}) => {
    if (silent) setRefreshing(true); else setLoading(true);
    return fetchAdminOrders()
      .then(setOrders)
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => { loadOrders(); }, []);

  const handleAdvance = async (order) => {
    const nextStatus = NEXT_STATUS[order.status];
    if (!nextStatus) return;
    setUpdatingId(order.id);
    try {
      const updated = await updateAdminOrderStatus(order.id, nextStatus);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (err) {
      alert(err?.response?.data?.detail || 'Could not update order status.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <ThrifterLoader />;

  // Recently placed sorts by vendor location (planning a pickup route);
  // on delivery sorts by the buyer's delivery location (planning a drop-off
  // route). Complete has no operational reason to group by area.
  const recentlyPlaced = orders.filter((o) => o.status === 'paid').sort(byLocation('vendor_location'));
  const onDelivery = orders.filter((o) => o.status === 'picked_up').sort(byLocation('delivery_address'));
  const complete = orders.filter((o) => o.status === 'delivered');

  // One row per line item — order-level fields (vendor, buyer, dates, status)
  // repeat on each row so every row is self-contained and scannable on its own.
  const rowsFor = (list) => list.flatMap((order) => order.items.map((oi) => ({ order, item: oi })));

  const OrderTable = ({ list, emptyText }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-x-auto">
      <table className="w-full text-sm min-w-[1400px]">
        <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Item</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Vendor</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Pickup location</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Buyer</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Delivery location</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Qty</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Price paid</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Pick up</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Deliver</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
          {rowsFor(list).map(({ order, item }) => (
            <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <img
                    src={getImageSrc({ image_path: item.image_path, fallback_url: item.fallback_url }, 100) || undefined}
                    alt={item.item_name_snapshot}
                    className="w-10 h-12 object-cover rounded-lg bg-gray-100 dark:bg-gray-700 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-medium line-clamp-1">{item.item_name_snapshot}</p>
                    <p className="text-xs text-gray-400">Order #{order.id}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-500">
                {order.vendor_name ? (
                  <Link to={`/vendor/${encodeURIComponent(order.vendor_name)}`} className="hover:underline">
                    {order.vendor_name}
                  </Link>
                ) : '—'}
                {order.vendor_whatsapp && (
                  <p className="text-xs text-gray-400">{order.vendor_whatsapp}</p>
                )}
              </td>
              <td className="px-4 py-3 text-gray-500 max-w-[220px]">{order.vendor_location || '—'}</td>
              <td className="px-4 py-3 text-gray-500">
                <p>{order.delivery_name}</p>
                <p className="text-xs text-gray-400">{order.delivery_phone}</p>
              </td>
              <td className="px-4 py-3 text-gray-500 max-w-[220px]">{order.delivery_address}</td>
              <td className="px-4 py-3 text-gray-500">{item.quantity}</td>
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                {formatUGX(item.price_at_purchase)}{item.quantity > 1 ? ' each' : ''}
              </td>
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(order.delivery_day)}</td>
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(order.delivery_day)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold uppercase px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_STYLES[order.status] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                  {NEXT_STATUS[order.status] && (
                    <button
                      onClick={() => handleAdvance(order)}
                      disabled={updatingId === order.id}
                      className="text-xs bg-[#EAAD11] text-black font-bold px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                    >
                      {updatingId === order.id ? 'Saving…' : NEXT_LABEL[order.status]}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length === 0 && (
        <p className="text-center py-12 text-gray-400 text-sm">{emptyText}</p>
      )}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="inline-flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          {[{ key: 'pending', label: 'Pending' }, { key: 'complete', label: 'Complete' }].map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                section === s.key
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-black dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => loadOrders({ silent: true })}
          disabled={refreshing}
          title="Refresh"
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {section === 'pending' ? (
        <div className="space-y-8">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-3">Recently placed</h3>
            <OrderTable list={recentlyPlaced} emptyText="No orders recently placed." />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-3">On delivery</h3>
            <OrderTable list={onDelivery} emptyText="No orders out for delivery." />
          </div>
        </div>
      ) : (
        <OrderTable list={complete} emptyText="No completed orders yet." />
      )}
    </div>
  );
};

export default AdminOrders;
