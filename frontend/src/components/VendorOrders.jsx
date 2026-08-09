import React, { useEffect, useState } from 'react';
import { fetchVendorOrders, updateVendorOrderStatus } from '../api';
import ThrifterLoader from './ThrifterLoader';

const formatUGX = (n) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
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

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-6 py-8">
      <h2 className="text-xl font-serif font-bold mb-6">My Orders</h2>
      {orders.length === 0 ? (
        <p className="text-gray-500 py-12 text-center">No orders yet.</p>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="border border-gray-200 dark:border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Pickup: {new Date(order.delivery_day).toLocaleDateString('en-UG', { weekday: 'long', month: 'long', day: 'numeric' })}
                </span>
                <span className="text-xs font-semibold uppercase px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
                  {order.status.replace('_', ' ')}
                </span>
              </div>
              {order.items.map((oi) => (
                <p key={oi.id} className="text-sm">{oi.item_name_snapshot} — {formatUGX(oi.price_at_purchase)}</p>
              ))}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <span className="text-sm">You receive: <strong>{formatUGX(order.vendor_payout_amount)}</strong></span>
                {NEXT_STATUS[order.status] && (
                  <button
                    onClick={() => handleAdvance(order)}
                    disabled={updatingId === order.id}
                    className="text-sm bg-[#EAAD11] text-black font-bold px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {NEXT_LABEL[order.status]}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
};

export default VendorOrders;
