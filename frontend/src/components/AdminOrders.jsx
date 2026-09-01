import React, { useEffect, useState } from 'react';
import { RefreshCw, X, MessageSquare } from 'lucide-react';
import { fetchAdminOrders, updateAdminOrderStatus, cancelAdminOrder } from '../api';
import { getImageSrc } from '../utils';
import { Link } from 'react-router-dom';
import ThrifterLoader from './ThrifterLoader';
import ImageLightbox from './ImageLightbox';
import { useToast } from '../context/ToastContext';

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

const CANCEL_REASONS = [
  { value: 'item_unavailable', label: 'Item unavailable (will be removed from the catalog)' },
  { value: 'buyer_requested', label: 'Buyer requested cancellation' },
  { value: 'delivery_issue', label: 'Delivery issue (bad/unreachable address)' },
  { value: 'vendor_unable_to_fulfill', label: 'Vendor unable to fulfill' },
  { value: 'other', label: 'Other' },
];

const CancelOrderModal = ({ order, onClose, onCancelled }) => {
  const [reason, setReason] = useState('buyer_requested');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const noteRequired = reason === 'other';

  const handleConfirm = async () => {
    if (noteRequired && !note.trim()) {
      setError('A note is required for "Other".');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const updated = await cancelAdminOrder(order.id, reason, note.trim() || undefined);
      onCancelled(updated);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not cancel this order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-serif font-bold mb-1">Cancel Order #{order.id}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {order.payment_method === 'cash_on_delivery'
            ? 'This was a cash-on-delivery order — nothing was charged, so there is nothing to refund. This cannot be undone.'
            : 'The buyer will be refunded via Nylon Pay. This cannot be undone.'}
        </p>

        <label className="block text-sm font-medium mb-1">Reason</label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 mb-4 focus:outline-none focus:ring-2 focus:ring-[#EAAD11]"
        >
          {CANCEL_REASONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        <label className="block text-sm font-medium mb-1">
          Note {noteRequired ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(optional)</span>}
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 mb-4 focus:outline-none focus:ring-2 focus:ring-[#EAAD11]"
          placeholder={noteRequired ? 'Required for "Other" — what happened?' : 'Any extra context for the record…'}
        />

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl font-semibold border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl font-bold bg-red-600 text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Cancelling…' : 'Confirm Cancellation'}
          </button>
        </div>
      </div>
    </div>
  );
};

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
  const { showToast, confirmToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [section, setSection] = useState('pending'); // 'pending' | 'complete'
  const [updatingId, setUpdatingId] = useState(null);
  const [cancelOrder, setCancelOrder] = useState(null); // order currently in the cancel-reason modal
  const [lightbox, setLightbox] = useState(null); // { src, alt } of the enlarged item image, or null

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
    const confirmed = await confirmToast(
      `Mark Order #${order.id} as "${STATUS_LABELS[nextStatus]}"? This notifies the vendor and buyer by SMS and cannot be undone.`,
      STATUS_LABELS[nextStatus]
    );
    if (!confirmed) return;
    setUpdatingId(order.id);
    try {
      const updated = await updateAdminOrderStatus(order.id, nextStatus);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Could not update order status.');
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
                    onClick={() => setLightbox({
                      src: getImageSrc({ image_path: item.image_path, fallback_url: item.fallback_url }, 1000),
                      alt: item.item_name_snapshot,
                    })}
                    className="w-10 h-12 object-cover rounded-lg bg-gray-100 dark:bg-gray-700 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                  />
                  <div className="min-w-0">
                    <p className="font-medium line-clamp-1">{item.item_name_snapshot}</p>
                    <p className="text-xs text-gray-400">Order #{order.id}</p>
                    {item.note && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1 mt-0.5 max-w-[220px]">
                        <MessageSquare className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span className="whitespace-normal break-words">{item.note}</span>
                      </p>
                    )}
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
                {order.payment_method === 'cash_on_delivery' && (
                  <span className="ml-1 font-semibold text-amber-600 dark:text-amber-400">(COD)</span>
                )}
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
                  {order.status !== 'delivered' && (
                    <button
                      onClick={() => setCancelOrder(order)}
                      disabled={updatingId === order.id}
                      className="text-xs text-red-600 font-semibold px-2 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 whitespace-nowrap"
                    >
                      Cancel
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

      {cancelOrder && (
        <CancelOrderModal
          order={cancelOrder}
          onClose={() => setCancelOrder(null)}
          onCancelled={(updated) => {
            setOrders((prev) => prev.filter((o) => o.id !== updated.id));
            setCancelOrder(null);
            if (updated.payment_method === 'cash_on_delivery') {
              showToast(`Order #${updated.id} cancelled. No refund needed — it was cash on delivery.`, 'success');
            } else if (updated.refund?.status === 'failed') {
              showToast(
                `Order #${updated.id} was cancelled, but the buyer's refund payout failed` +
                (updated.refund.failure_reason ? ` (${updated.refund.failure_reason})` : '') +
                `. Refund UGX ${updated.refund.amount?.toLocaleString('en-UG')} manually via the Nylon Pay dashboard.`
              );
            } else {
              showToast(`Order #${updated.id} cancelled and refunded.`, 'success');
            }
          }}
        />
      )}

      {lightbox && (
        <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
};

export default AdminOrders;
