// Prompts a free-tier vendor to upgrade to Premium once they've hit their free
// item slot limit (or from the vendor's own Subscription tab). Modeled on
// AuthModal's shell/spinner conventions; stacks above it at z-[110].
import React, { useEffect, useState } from 'react';
import { X, Crown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchVendorSlotStatus, initiateVendorSubscriptionPayment } from '../api';

const formatUGX = (n) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
};

const UpgradeToPremiumModal = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadStatus = () => {
    setLoading(true);
    return fetchVendorSlotStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isOpen) return;
    loadStatus();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    setSubmitting(true);
    try {
      const res = await initiateVendorSubscriptionPayment('nylon');
      window.location.href = res.redirect_url;
    } catch (e) {
      const detail = e?.response?.data?.detail;
      // The backend rejects with these specific codes when it already knows
      // this attempt would double-charge — re-sync our own state to match
      // instead of just alerting and leaving the stale "Upgrade Now" button.
      if (detail && typeof detail === 'object' && (detail.code === 'already_premium' || detail.code === 'subscription_payment_pending')) {
        await loadStatus();
      } else {
        const msg = (typeof detail === 'string' && detail) || e?.message || 'Could not start checkout';
        alert(msg);
      }
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative bg-white dark:bg-gray-900 w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
        >
          <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6 sm:hidden" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>

          {loading ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <Crown className="w-5 h-5 text-[#EAAD11]" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Upgrade to Premium</h3>
              </div>
              <div className="py-6 text-center text-sm text-gray-400">Loading your account status…</div>
            </>
          ) : status?.is_premium ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <Check className="w-5 h-5 text-green-500" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">You're already Premium</h3>
              </div>
              <p className="text-sm text-gray-500 mb-5">
                {status.expires_at
                  ? `Your plan renews/expires ${new Date(status.expires_at).toLocaleDateString()}. You have unlimited item slots.`
                  : 'You have unlimited item slots — nothing more to do here.'}
              </p>
              <button
                onClick={onClose}
                className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all"
              >
                Got it
              </button>
            </>
          ) : status?.pending_payment ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <Crown className="w-5 h-5 text-[#EAAD11]" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Payment pending</h3>
              </div>
              <p className="text-sm text-gray-500 mb-5">
                We're waiting on confirmation from your payment provider for a Premium upgrade you already started.
                This can take a minute — no need to pay again.
              </p>
              <button
                disabled={loading}
                onClick={loadStatus}
                className="w-full bg-[#EAAD11] text-black py-4 rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50"
              >
                Check again
              </button>
              <button
                onClick={onClose}
                className="w-full text-center text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 py-3"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <Crown className="w-5 h-5 text-[#EAAD11]" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Upgrade to Premium</h3>
              </div>
              <p className="text-sm text-gray-500 mb-5">
                Free accounts can list up to {status?.free_item_limit ?? 10} active items. Go Premium for unlimited listings.
              </p>

              {status && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-5 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Active listings</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{status.active_item_count} / {status.free_item_limit}</span>
                  </div>
                  {status.hidden_item_count > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Hidden (over limit)</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{status.hidden_item_count}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-black dark:bg-gray-800 rounded-xl p-4 mb-5 text-white">
                <div className="text-2xl font-bold">{formatUGX(status?.price_ugx ?? 50000)}</div>
                <div className="text-xs text-white/70">every 30 days · unlimited item slots</div>
              </div>

              <button
                disabled={submitting}
                onClick={handleUpgrade}
                className="w-full bg-[#EAAD11] text-black py-4 rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-lg"
              >
                {submitting ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-black/30 border-b-black rounded-full animate-spin" />
                    <span>Redirecting…</span>
                  </div>
                ) : (
                  'Upgrade Now'
                )}
              </button>

              <button
                onClick={onClose}
                className="w-full text-center text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 py-3"
              >
                Maybe later
              </button>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default UpgradeToPremiumModal;
