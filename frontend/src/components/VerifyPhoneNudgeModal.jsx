// Aggressively (but dismissibly) nudges an unverified vendor to verify their
// phone every time they land on their own page — items stay invisible to
// buyers on the marketplace until phone_verified_at is set. Shell modeled on
// UpgradeToPremiumModal's bottom-sheet/backdrop conventions.
import React, { useState } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api, { sendVendorPhoneVerification } from '../api';

const VerifyPhoneNudgeModal = ({ isOpen, onClose, phone: initialPhone, vendorName, description, location, onAlreadyVerified }) => {
  const [phone, setPhone] = useState(initialPhone || '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSend = async () => {
    setError('');
    setSending(true);
    try {
      const trimmed = phone.trim();
      // Only touch the profile if the vendor actually edited the number —
      // avoids re-saving name/description/location for a no-op phone match.
      if (trimmed !== (initialPhone || '').trim()) {
        await api.put('/vendor/me', {
          name: vendorName,
          whatsapp: trimmed,
          description: description || null,
          location: location || null,
        });
      }
      const res = await sendVendorPhoneVerification();
      if (res.status === 'already_verified') {
        onAlreadyVerified?.();
        onClose();
      } else {
        setSent(true);
      }
    } catch (e) {
      setError(e?.response?.data?.detail || 'Could not send verification SMS. Please try again.');
    } finally {
      setSending(false);
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

          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-[#EAAD11]" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Verify your phone number</h3>
          </div>

          {sent ? (
            <>
              <p className="text-sm text-gray-500 mb-5">
                We've sent a verification link by SMS to <span className="font-semibold text-gray-700 dark:text-gray-300">{phone.trim()}</span>. Open the message and tap the link to verify.
              </p>
              <button
                onClick={onClose}
                className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all"
              >
                Got it
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">
                Your items aren't visible to buyers until your phone number is verified. Confirm the number below and we'll text you a verification link.
              </p>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+256..."
                className="w-full p-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-1 focus:ring-black dark:focus:ring-gray-500 outline-none mb-2"
              />
              {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
              <button
                onClick={handleSend}
                disabled={sending || !phone.trim()}
                className="w-full bg-[#EAAD11] text-black py-4 rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mb-3"
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-b-black rounded-full animate-spin" />
                    <span>Sending…</span>
                  </>
                ) : (
                  'Send verification SMS'
                )}
              </button>
              <button
                onClick={onClose}
                className="w-full text-center text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 py-1"
              >
                Dismiss
              </button>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default VerifyPhoneNudgeModal;
