import React, { useEffect, useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { fetchMyOrders } from '../api';
import { ORDER_STATUS_LABELS } from '../utils';
import ThrifterLoader from './ThrifterLoader';

const formatUGX = (n) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
};

// Same official Thrifter contact number used elsewhere (Navbar's
// contact/social dropdown). There's no self-service cancel endpoint — this
// just gets the buyer to support with the right order already identified,
// instead of them having to separately find how to reach us and explain
// from scratch. Ported from mobile/app/orders.tsx.
const CANCEL_WHATSAPP_NUMBER = '256794185787';

const isCancellable = (c) => c.orders.every((o) => o.status === 'pending' || o.status === 'paid');

const buildCancelMessage = (c) => {
  const itemNames = c.orders.flatMap((o) => o.items.map((i) => i.item_name_snapshot));
  const itemsText = itemNames.length > 3
    ? `${itemNames.slice(0, 3).join(', ')}, +${itemNames.length - 3} more`
    : itemNames.join(', ');
  return `Hi Thrifter, I'd like to cancel my order #${c.id} (${itemsText}). Please help me process this.`;
};

const Orders = () => {
  const [checkouts, setCheckouts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyOrders().then(setCheckouts).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <ThrifterLoader />;

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-6 py-8">
      <h2 className="text-xl font-serif font-bold mb-6">My Orders</h2>
      {checkouts.length === 0 ? (
        <p className="text-gray-500 py-12 text-center">No orders yet.</p>
      ) : (
        <div className="space-y-6">
          {checkouts.map((c) => (
            <div key={c.id} className="border border-gray-200 dark:border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Delivery: {new Date(c.delivery_day).toLocaleDateString('en-UG', { weekday: 'long', month: 'long', day: 'numeric' })}
                </span>
                <span className="text-sm font-bold">{formatUGX(c.total_amount)}</span>
              </div>
              {c.orders.map((order) => (
                <div key={order.id} className="mb-2 last:mb-0">
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
                    {order.vendor_name} · <span>{ORDER_STATUS_LABELS[order.status] || order.status}</span>
                  </p>
                  {order.items.map((oi) => (
                    <p key={oi.id} className="text-sm">
                      {oi.item_name_snapshot}{oi.quantity > 1 ? ` × ${oi.quantity}` : ''} — {formatUGX(oi.price_at_purchase * (oi.quantity || 1))}
                    </p>
                  ))}
                </div>
              ))}
              {isCancellable(c) && (
                <a
                  href={`https://wa.me/${CANCEL_WHATSAPP_NUMBER}?text=${encodeURIComponent(buildCancelMessage(c))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-semibold text-[#EAAD11] hover:opacity-80 mt-2"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  Want to cancel this order?
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
};

export default Orders;
