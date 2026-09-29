import React, { useEffect, useState } from 'react';
import { Wallet, MessageSquare, X } from 'lucide-react';
import { fetchVendorOrders, fetchVendorWallet, requestVendorWithdrawal } from '../api';
import { getImageSrc, getLightboxImages, ORDER_STATUS_LABELS } from '../utils';
import ThrifterLoader from './ThrifterLoader';
import ImageLightbox from './ImageLightbox';
import { useToast } from '../context/ToastContext';

const formatUGX = (n) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
};

const formatDate = (d) => new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' });

// Shown once per browser until dismissed — a new vendor's first visit to this
// tab is often before they have any orders, so this is the one place to set
// expectations for the whole flow (list -> we handle logistics -> get paid)
// before the wallet/table below start filling in with real numbers.
const INTRO_DISMISSED_KEY = 'thrifter_vendor_orders_intro_dismissed';

const STATUS_STYLES = {
  paid: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  picked_up: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  delivered: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

// Record-keeping only — the vendor can no longer advance an order's status
// themselves (an admin-side flow will own that; see PATCH /vendor/orders
// removal). This tab just reflects whatever status the order is currently in.
const VendorOrders = () => {
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { src, alt } of the enlarged item image, or null
  const [showIntro, setShowIntro] = useState(() => {
    try { return localStorage.getItem(INTRO_DISMISSED_KEY) !== '1'; } catch { return true; }
  });

  useEffect(() => {
    fetchVendorOrders().then(setOrders).catch(() => {}).finally(() => setLoading(false));
    fetchVendorWallet().then(setWallet).catch(() => {});
  }, []);

  const dismissIntro = () => {
    setShowIntro(false);
    try { localStorage.setItem(INTRO_DISMISSED_KEY, '1'); } catch { /* per-viewer convenience only */ }
  };

  const handleWithdraw = async () => {
    if (!window.confirm(`Withdraw ${formatUGX(wallet.balance)}? An admin will review and send it to your phone number.`)) return;
    setWithdrawing(true);
    try {
      const updated = await requestVendorWithdrawal();
      setWallet(updated);
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Could not request withdrawal.');
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) return <ThrifterLoader />;

  const belowMinimumPayout = wallet && wallet.balance > 0 && wallet.balance < wallet.min_payout_amount;

  // One row per line item — order-level fields (dates, status, payout, action)
  // repeat on each row so every row is self-contained and scannable on its own.
  const rows = orders.flatMap((order) =>
    order.items.map((oi) => ({ order, item: oi }))
  );

  return (
    <div>
      {showIntro ? (
        <div className="relative bg-[#FFFBEB] dark:bg-gray-800 border border-[#EAAD11]/30 dark:border-[#EAAD11]/20 rounded-xl p-5 mb-6">
          <button
            onClick={dismissIntro}
            aria-label="Dismiss"
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
          >
            <X className="w-4 h-4" />
          </button>
          <p className="font-semibold text-sm mb-3 pr-6">How orders work</p>
          <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <li className="flex gap-2.5">
              <span className="font-bold text-[#EAAD11] shrink-0">1.</span>
              <span>List an item — buyers can order it once it's live.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="font-bold text-[#EAAD11] shrink-0">2.</span>
              <span>We collect it from you on the pickup date and deliver it — no shipping or drop-off needed from you.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="font-bold text-[#EAAD11] shrink-0">3.</span>
              <span>Get paid — the payout lands in your wallet once delivery is confirmed, minus commission.</span>
            </li>
          </ol>
        </div>
      ) : (
        // Re-opens the same card above — for a vendor who dismissed or
        // switched tabs before finishing it the first time, rather than
        // making them wait for some other trigger to see it again.
        <div className="flex justify-end mb-3">
          <button
            onClick={() => setShowIntro(true)}
            className="text-xs font-semibold text-[#EAAD11] hover:underline"
          >
            How orders work?
          </button>
        </div>
      )}
      {wallet && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#EAAD11]/15 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-[#EAAD11]" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Wallet balance</p>
              <p className="text-xl font-bold">{formatUGX(wallet.balance)}</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">Added once a delivery is confirmed, after commission</p>
            </div>
          </div>
          {wallet.pending_withdrawal ? (
            <div className="text-right">
              <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                {formatUGX(wallet.pending_withdrawal.amount)} pending admin approval
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Requested {formatDate(wallet.pending_withdrawal.requested_at)}</p>
            </div>
          ) : wallet.in_progress_withdrawal ? (
            <div className="text-right max-w-xs">
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                {formatUGX(wallet.in_progress_withdrawal.amount)} withdrawal in progress
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                We're actively working on the withdrawal amidst network issues. In case it's been over a
                few hours,{' '}
                <a
                  href="https://wa.me/256794185787"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#EAAD11] hover:underline font-medium"
                >
                  contact us
                </a>.
              </p>
            </div>
          ) : (
            <div className="text-right">
              <button
                onClick={handleWithdraw}
                disabled={withdrawing || wallet.balance <= 0 || belowMinimumPayout}
                className="text-sm bg-[#EAAD11] text-black font-bold px-4 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                {withdrawing ? 'Requesting…' : 'Withdraw'}
              </button>
              {belowMinimumPayout && (
                <p className="text-xs text-gray-400 mt-1">Minimum withdrawal is {formatUGX(wallet.min_payout_amount)}</p>
              )}
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
        We collect items from you on the pickup date shown below, and you receive your payout (minus commission) after the delivery is confirmed.
      </p>
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
                    onClick={() => setLightbox({ ...getLightboxImages(item), alt: item.item_name_snapshot })}
                    className="w-10 h-12 object-cover rounded-lg bg-gray-100 dark:bg-gray-700 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                  />
                  <div className="min-w-0">
                    <p className="font-medium line-clamp-1">{item.item_name_snapshot}</p>
                    <p className="text-xs text-gray-400">
                      Order #{order.id} · {formatUGX(item.price_at_purchase)}{item.quantity > 1 ? ' each' : ''}
                    </p>
                    {item.note && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1 mt-0.5 max-w-[220px]">
                        <MessageSquare className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span className="whitespace-normal break-words">{item.note}</span>
                      </p>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-500">{item.quantity}</td>
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(order.created_at)}</td>
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(order.delivery_day)}</td>
              <td className="px-4 py-3">
                <span className={`text-xs font-semibold uppercase px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_STYLES[order.status] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                  {ORDER_STATUS_LABELS[order.status] || order.status}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <p className="font-medium">{formatUGX(order.vendor_payout_amount)}</p>
                <p className="text-xs text-gray-400">after {formatUGX(order.commission_amount)} commission</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && (
        <p className="text-center py-12 text-gray-400 text-sm">No orders yet.</p>
      )}
      </div>

      {lightbox && (
        <ImageLightbox images={lightbox.images} initialIndex={lightbox.initialIndex} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
};

export default VendorOrders;
