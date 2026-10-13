// Mobile port of frontend/src/components/UpgradeToPremiumModal.jsx. One
// difference from web: initiateVendorSubscriptionPayment's redirect_url is
// just the vendor's own web storefront page (`?subscription=complete` is
// vestigial — web doesn't even read it) — mobile money pushes a PIN prompt
// straight to the phone, so there's nothing to open in a browser; we just
// tell the vendor to approve it and close, same as Checkout's mobile-money
// path.
import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';

const formatUGX = (n: number) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
};

const daysUntil = (isoDate: string) => Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86400000);

const POLL_INTERVAL_MS = 5000;
const POLL_MAX_MINUTES = 20;
const POLL_MAX_ATTEMPTS = Math.ceil((POLL_MAX_MINUTES * 60 * 1000) / POLL_INTERVAL_MS);

export type SlotStatus = {
  is_premium: boolean;
  expires_at: string | null;
  active_item_count: number;
  hidden_item_count: number;
  free_item_limit: number;
  price_ugx: number;
  commission_rate: number;
  premium_commission_rate: number;
  pending_payment: boolean;
  last_failure_reason: string | null;
  vendor_whatsapp: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onUpgraded?: () => void;
};

export default function UpgradeToPremiumModal({ visible, onClose, onUpgraded }: Props) {
  const { showToast } = useToast();
  const [status, setStatus] = useState<SlotStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failureDismissed, setFailureDismissed] = useState(false);
  const [phone, setPhone] = useState('');
  const pollAttemptsRef = useRef(0);

  const loadStatus = () => {
    setLoading(true);
    return api.get<SlotStatus>('/vendor/me/subscription')
      .then(({ data }) => setStatus(data))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!visible) return;
    setFailureDismissed(false);
    setPhone('');
    pollAttemptsRef.current = 0;
    loadStatus();
  }, [visible]);

  useEffect(() => {
    if (status?.vendor_whatsapp && !phone) setPhone(status.vendor_whatsapp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (!visible || !status?.pending_payment) return;
    if (pollAttemptsRef.current >= POLL_MAX_ATTEMPTS) return;
    const timer = setTimeout(() => {
      pollAttemptsRef.current += 1;
      loadStatus();
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, status]);

  const handleUpgrade = async () => {
    if (!phone.trim()) {
      showToast('Please enter the mobile money number to pay with.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/vendor/subscription/checkout', { provider: 'nylon', phone: phone.trim() });
      showToast('Approve the mobile money prompt on your phone to complete your upgrade.', 'success');
      onUpgraded?.();
      onClose();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (detail && typeof detail === 'object' && (detail.code === 'already_premium' || detail.code === 'subscription_payment_pending')) {
        await loadStatus();
      } else {
        const msg = (typeof detail === 'string' && detail) || e?.message || 'Could not start checkout';
        showToast(msg, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const showFailure = !loading && !status?.is_premium && !status?.pending_payment && status?.last_failure_reason && !failureDismissed;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-white dark:bg-gray-900 rounded-t-3xl px-6 pt-5" style={{ maxHeight: '88%' }}>
          <View className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full self-center mb-5" />
          <TouchableOpacity onPress={onClose} className="absolute top-4 right-4 p-2 z-10">
            <Ionicons name="close" size={20} color="#6B7280" />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {loading ? (
              <>
                <View className="flex-row items-center gap-2 mb-1">
                  <Ionicons name="ribbon" size={18} color="#EAAD11" />
                  <Text className="text-xl font-bold text-gray-900 dark:text-white">Upgrade to Premium</Text>
                </View>
                <View className="py-8 items-center">
                  <ActivityIndicator color="#EAAD11" />
                  <Text className="text-sm text-gray-400 dark:text-gray-500 mt-2">Loading your account status…</Text>
                </View>
              </>
            ) : status?.pending_payment ? (
              <>
                <View className="flex-row items-center gap-2 mb-1">
                  <Ionicons name="ribbon" size={18} color="#EAAD11" />
                  <Text className="text-xl font-bold text-gray-900 dark:text-white">Payment pending</Text>
                </View>
                <Text className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                  We're waiting on confirmation from your payment provider for the Premium upgrade you started. This can take a few minutes.
                </Text>
                <View className="bg-gray-100 dark:bg-gray-800 rounded-xl py-4 items-center flex-row justify-center gap-2">
                  <ActivityIndicator color="#9CA3AF" size="small" />
                  <Text className="text-gray-400 dark:text-gray-500 font-bold">Checking status…</Text>
                </View>
              </>
            ) : showFailure ? (
              <>
                <View className="flex-row items-center gap-2 mb-1">
                  <Ionicons name="close-circle" size={18} color="#EF4444" />
                  <Text className="text-xl font-bold text-gray-900 dark:text-white">Payment didn't go through</Text>
                </View>
                <Text className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Your mobile money provider didn't approve the last attempt — usually that means the PIN prompt wasn't confirmed in time, or there wasn't enough balance on that number. Double-check both, or try a different number, then try again.
                </Text>
                <View className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 mb-4">
                  <Text className="text-xs text-red-700 dark:text-red-300">Provider said: "{status?.last_failure_reason}"</Text>
                </View>
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Mobile money number</Text>
                <TextInput
                  className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-3 py-3 text-sm text-gray-900 dark:text-gray-100 mb-4"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="e.g. 0772123456"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                />
                <TouchableOpacity
                  disabled={submitting}
                  onPress={() => { setFailureDismissed(true); handleUpgrade(); }}
                  className="bg-black rounded-xl py-4 items-center mb-2"
                  style={{ opacity: submitting ? 0.5 : 1 }}
                >
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">Try again</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setFailureDismissed(true)} className="items-center py-2">
                  <Text className="text-sm text-gray-500 dark:text-gray-400">Maybe later</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View className="flex-row items-center gap-2 mb-1">
                  <Ionicons name="ribbon" size={18} color="#EAAD11" />
                  <Text className="text-xl font-bold text-gray-900 dark:text-white">{status?.is_premium ? 'Your plan' : 'Upgrade to Premium'}</Text>
                </View>
                <Text className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {status?.is_premium
                    ? (status.expires_at
                        ? `Renews/expires ${new Date(status.expires_at).toLocaleDateString()}.`
                        : 'You have unlimited item slots.')
                    : `Free accounts can list up to ${status?.free_item_limit ?? 10} active items. Go Premium for unlimited listings.`}
                </Text>

                {status?.is_premium ? (
                  <>
                    {status.expires_at && daysUntil(status.expires_at) <= 3 && (
                      <View className="flex-row items-center gap-1.5 mb-4">
                        <Ionicons name="ribbon" size={14} color="#D97706" />
                        <Text className="text-sm font-semibold text-amber-600 flex-1">
                          {daysUntil(status.expires_at) >= 2
                            ? `Ends in ${daysUntil(status.expires_at)} days — pay now to keep unlimited slots.`
                            : 'Ends soon — pay now to keep unlimited slots.'}
                        </Text>
                      </View>
                    )}
                    <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Mobile money number to pay with</Text>
                    <TextInput
                      className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-3 py-3 text-sm text-gray-900 dark:text-gray-100 mb-5"
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="e.g. 0772123456"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="phone-pad"
                    />
                    <TouchableOpacity
                      disabled={submitting || !phone.trim()}
                      onPress={handleUpgrade}
                      className="bg-black rounded-xl py-4 items-center mb-3"
                      style={{ opacity: submitting || !phone.trim() ? 0.5 : 1 }}
                    >
                      {submitting
                        ? <ActivityIndicator color="#fff" />
                        : <Text className="text-white font-bold">Pay for another month — {formatUGX(status.price_ugx)}</Text>}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {status && (
                      <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-5">
                        <View className="flex-row justify-between mb-1">
                          <Text className="text-sm text-gray-500 dark:text-gray-400">Active listings</Text>
                          <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">{status.active_item_count} / {status.free_item_limit}</Text>
                        </View>
                        {status.hidden_item_count > 0 && (
                          <View className="flex-row justify-between">
                            <Text className="text-sm text-gray-500 dark:text-gray-400">Hidden (over limit)</Text>
                            <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">{status.hidden_item_count}</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {status && (
                      <View className="mb-5">
                        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Mobile money number to pay with</Text>
                        <TextInput
                          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-3 py-3 text-sm text-gray-900 dark:text-gray-100"
                          value={phone}
                          onChangeText={setPhone}
                          placeholder="e.g. 0772123456"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="phone-pad"
                        />
                      </View>
                    )}

                    <View className="flex-row gap-3 mb-5">
                      <View className="flex-1 bg-black rounded-2xl p-4">
                        <View className="self-start bg-white rounded-full px-2 py-1 mb-3">
                          <Text className="text-black text-[10px] font-bold">UGX 0/MONTH</Text>
                        </View>
                        <Text className="text-white text-lg font-extrabold mb-3">FREE</Text>
                        <Text className="text-white/80 text-xs mb-1">{status?.free_item_limit ?? 10} product slots</Text>
                        <Text className="text-white/80 text-xs mb-4">{status ? Math.round(status.commission_rate * 100) : 10}% commission</Text>
                        <View className="border border-white/40 rounded-lg py-2.5 items-center">
                          <Text className="text-white text-xs font-bold">CURRENT PLAN</Text>
                        </View>
                      </View>

                      <View className="flex-1 bg-[#EAAD11] rounded-2xl p-4">
                        <View className="self-start bg-black rounded-full px-2 py-1 mb-3">
                          <Text className="text-white text-[10px] font-bold">{formatUGX(status?.price_ugx ?? 50000)}/MO</Text>
                        </View>
                        <Text className="text-black text-lg font-extrabold mb-3">PREMIUM</Text>
                        <Text className="text-black/80 text-xs font-medium mb-1">Unlimited slots</Text>
                        <Text className="text-black/80 text-xs font-medium mb-4">{status ? Math.round(status.premium_commission_rate * 100) : 5}% commission</Text>
                        <TouchableOpacity
                          disabled={submitting || !phone.trim()}
                          onPress={handleUpgrade}
                          className="bg-black rounded-lg py-2.5 items-center"
                          style={{ opacity: submitting || !phone.trim() ? 0.5 : 1 }}
                        >
                          {submitting
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <Text className="text-white text-xs font-bold">UPGRADE NOW</Text>}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}

                <TouchableOpacity onPress={onClose} className="items-center py-2">
                  <Text className="text-sm text-gray-500 dark:text-gray-400">{status?.is_premium ? 'Close' : 'Maybe later'}</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
