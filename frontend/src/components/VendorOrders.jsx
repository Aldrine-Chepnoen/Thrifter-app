import React, { useEffect, useState } from 'react';
import { fetchVendorOrders, updateVendorOrderStatus } from '../api';
import { getImageSrc } from '../utils';
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

const NEXT_STATUS = { paid: 'picked_up', picked_up: 'delivered' };
const NEXT_LABEL = { paid: 'Mark Picked Up', picked_up: 'Mark Delivered' };

const VendorOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    fetchVendorOrders().then(setOrders).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleAdvance = async (order) => {
    const nextStatus = NEXT_STATUS[order.status];
    if (!nextStatus) return;
    setUpdatingId(order.id);
    try {
      const updated = await updateVendorOrderStatus(order.id, nextStatus);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (err) {
      alert(err?.response?.data?.detail || 'Could not update order status.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <ThrifterLoader />;

  // One row per line item — order-level fields (dates, status, payout, action)
  // repeat on each row so every row is self-contained and scannable on its own.
  const rows = orders.flatMap((order) =>
    order.items.map((oi) => ({ order, item: oi }))
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-x-auto">
      <table className="w-full text-sm min-w-[820px]">
        <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Item</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Qty</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Placed</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Pickup</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">You receive</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
          {rows.map(({ order, item }) => (
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
                    <p className="text-xs text-gray-400">
                      Order #{order.id} · {formatUGX(item.price_at_purchase)}{item.quantity > 1 ? ' each' : ''}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-500">{item.quantity}</td>
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(order.created_at)}</td>
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(order.delivery_day)}</td>
              <td className="px-4 py-3">
                <span className={`text-xs font-semibold uppercase px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_STYLES[order.status] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                  {order.status.replace('_', ' ')}
                </span>
              </td>
              <td className="px-4 py-3 font-medium whitespace-nowrap">{formatUGX(order.vendor_payout_amount)}</td>
              <td className="px-4 py-3">
                {NEXT_STATUS[order.status] ? (
                  <button
                    onClick={() => handleAdvance(order)}
                    disabled={updatingId === order.id}
                    className="text-xs bg-[#EAAD11] text-black font-bold px-3 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                  >
                    {NEXT_LABEL[order.status]}
                  </button>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && (
        <p className="text-center py-12 text-gray-400 text-sm">No orders yet.</p>
      )}
    </div>
  );
};

export default VendorOrders;
