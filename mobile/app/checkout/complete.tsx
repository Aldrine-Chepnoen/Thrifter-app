// Mobile port of frontend/src/components/OrderConfirmation.jsx — polls
// GET /checkout/{id} until the payment resolves (webhook / verify()), and
// offers a cash-on-delivery retry when a mobile money payment fails.
import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';

const formatUGX = (n: number) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
};

type OrderItem = {
  id: number;
  item_id: number | null;
  item_name_snapshot: string;
  price_at_purchase: number;
  quantity: number;
  note?: string | null;
};

type CheckoutStatus = {
  id: number;
  status: string;
  payment_method: string;
  delivery_day: string;
  delivery_name: string;
  delivery_phone: string;
  delivery_address: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  orders: { items: OrderItem[] }[];
};

type CodRetryState = { checkout: CheckoutStatus | null; submitting: boolean } | null;

export default function CheckoutCompleteScreen() {
  const params = useLocalSearchParams<{ checkout_id: string }>();
  const [checkoutId, setCheckoutId] = useState(params.checkout_id);
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [checkout, setCheckout] = useState<CheckoutStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [codRetry, setCodRetry] = useState<CodRetryState>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!checkoutId) return;
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      try {
        const { data } = await api.get<CheckoutStatus>(`/checkout/${checkoutId}`);
        if (cancelled) return;
        setCheckout(data);
        attempts += 1;
        if (data.status === 'pending') {
          if (attempts < 20) timerRef.current = setTimeout(poll, 3000);
          else setTimedOut(true);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.response?.data?.detail || 'Could not load order status.');
      }
    };
    poll();

    return () => { cancelled = true; clearTimeout(timerRef.current); };
  }, [checkoutId]);

  // Rebuilds a checkout from the failed one's own item_id/quantity/note and
  // delivery fields rather than the buyer's cart — the cart was already
  // cleared the moment they were redirected to pay, so it's empty by now.
  const handleTryCod = async () => {
    if (!checkout) return;
    setCodRetry({ checkout: null, submitting: true });
    try {
      const items = checkout.orders
        .flatMap((o) => o.items)
        .filter((oi) => oi.item_id != null)
        .map((oi) => ({ item_id: oi.item_id, quantity: oi.quantity, note: oi.note || undefined }));
      const { data } = await api.post<CheckoutStatus>('/checkout', {
        items,
        delivery_name: checkout.delivery_name,
        delivery_phone: checkout.delivery_phone,
        delivery_address: checkout.delivery_address,
        delivery_lat: checkout.delivery_lat,
        delivery_lng: checkout.delivery_lng,
        payment_method: 'cash_on_delivery',
      });
      setCodRetry({ checkout: data, submitting: false });
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const nameById = new Map(checkout.orders.flatMap((o) => o.items).map((oi) => [oi.item_id, oi.item_name_snapshot]));
      let msg: string;
      if (detail && typeof detail === 'object' && Array.isArray(detail.items)) {
        msg = detail.items.map((s: any) => {
          const name = nameById.get(s.item_id) || `Item #${s.item_id}`;
          return s.available > 0
            ? `${name}: only ${s.available} left (you requested ${s.requested})`
            : `${name} is no longer available`;
        }).join('; ');
      } else {
        msg = (typeof detail === 'object' ? detail.message : detail) || err?.message || 'Could not start a cash-on-delivery order, please try again.';
      }
      showToast(msg, 'error');
      setCodRetry(null);
    }
  };

  const handlePlaceCodRetry = async () => {
    if (!codRetry?.checkout) return;
    setCodRetry((prev) => (prev ? { ...prev, submitting: true } : prev));
    try {
      const { data } = await api.post<CheckoutStatus>(`/checkout/${codRetry.checkout.id}/confirm-cod`);
      // Reuses the existing "paid" success view above by swapping in the new
      // checkout, rather than duplicating that UI for the retry path.
      setCheckoutId(String(data.id));
      setCheckout(data);
      setCodRetry(null);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = (typeof detail === 'object' ? detail.message : detail) || err?.message || 'Could not place your order, please try again.';
      showToast(msg, 'error');
      setCodRetry((prev) => (prev ? { ...prev, submitting: false } : prev));
    }
  };

  const Wrap = ({ children }: { children: React.ReactNode }) => (
    <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center px-8" style={{ paddingTop: insets.top }}>
      {children}
    </View>
  );

  if (!checkoutId) {
    return (
      <Wrap>
        <Text className="text-gray-500 dark:text-gray-400 mb-4">No order to show.</Text>
        <TouchableOpacity onPress={() => router.replace('/')}>
          <Text className="text-[#EAAD11] font-semibold">Back to feed</Text>
        </TouchableOpacity>
      </Wrap>
    );
  }

  if (error) {
    return <Wrap><Text className="text-red-600 text-center">{error}</Text></Wrap>;
  }

  if (timedOut && (!checkout || checkout.status === 'pending')) {
    return (
      <Wrap>
        <ActivityIndicator color="#EAAD11" size="large" />
        <Text className="text-lg font-serif-bold text-gray-900 dark:text-white mt-4 mb-2 text-center">This is taking longer than usual</Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
          We're still waiting to hear back from the payment provider. If you completed the mobile money prompt, your order should appear in My Orders shortly — no need to pay again.
        </Text>
        <TouchableOpacity onPress={() => router.replace('/orders')} className="bg-[#EAAD11] rounded-xl px-6 py-3">
          <Text className="text-black font-bold">Check My Orders</Text>
        </TouchableOpacity>
      </Wrap>
    );
  }

  if (!checkout || checkout.status === 'pending') {
    return (
      <Wrap>
        <ActivityIndicator color="#EAAD11" size="large" />
        <Text className="text-lg font-serif-bold text-gray-900 dark:text-white mt-4 mb-1">Confirming your payment...</Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400">This usually takes a few seconds.</Text>
      </Wrap>
    );
  }

  if (checkout.status === 'paid') {
    return (
      <Wrap>
        <Ionicons name="checkmark-circle" size={56} color="#16A34A" />
        <Text className="text-lg font-serif-bold text-gray-900 dark:text-white mt-4 mb-1 text-center">Order confirmed!</Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
          Delivery scheduled for {new Date(checkout.delivery_day).toLocaleDateString('en-UG', { weekday: 'long', month: 'long', day: 'numeric' })}.
        </Text>
        <TouchableOpacity onPress={() => router.replace('/orders')} className="bg-[#EAAD11] rounded-xl px-6 py-3">
          <Text className="text-black font-bold">View My Orders</Text>
        </TouchableOpacity>
      </Wrap>
    );
  }

  if (codRetry?.checkout) {
    const retry = codRetry.checkout;
    return (
      <View className="flex-1 bg-white dark:bg-gray-900" style={{ paddingTop: insets.top }}>
        <View className="flex-1 px-6 pt-10">
          <Text className="text-xl font-serif-bold text-gray-900 dark:text-white mb-6 text-center">Confirm cash on delivery</Text>
          {retry.orders.flatMap((o) => o.items).map((oi) => (
            <View key={oi.id} className="flex-row justify-between mb-2">
              <Text className="text-sm text-gray-700 dark:text-gray-300 flex-1 pr-2" numberOfLines={1}>
                {oi.item_name_snapshot}{oi.quantity > 1 ? ` × ${oi.quantity}` : ''}
              </Text>
              <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatUGX(oi.price_at_purchase * oi.quantity)}</Text>
            </View>
          ))}
          <View className="pt-3 mt-2 border-t border-gray-100 dark:border-gray-800">
            <View className="flex-row justify-between mb-1">
              <Text className="text-sm text-gray-500 dark:text-gray-400">Subtotal</Text>
              <Text className="text-sm text-gray-700 dark:text-gray-300">{formatUGX(retry.subtotal)}</Text>
            </View>
            <View className="flex-row justify-between mb-1">
              <Text className="text-sm text-gray-500 dark:text-gray-400">Delivery fee</Text>
              <Text className="text-sm text-gray-700 dark:text-gray-300">{formatUGX(retry.delivery_fee)}</Text>
            </View>
            <View className="flex-row justify-between pt-2 mt-1 border-t border-gray-100 dark:border-gray-800">
              <Text className="font-semibold text-gray-900 dark:text-gray-100">Total</Text>
              <Text className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatUGX(retry.total_amount)}</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={handlePlaceCodRetry}
            disabled={codRetry.submitting}
            className="bg-[#EAAD11] rounded-xl py-4 items-center mt-6"
            style={{ opacity: codRetry.submitting ? 0.6 : 1 }}
          >
            {codRetry.submitting
              ? <ActivityIndicator color="#000" />
              : <Text className="text-black font-bold text-base">Place order — pay on delivery</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCodRetry(null)} className="items-center py-3 mt-1">
            <Text className="text-sm text-gray-400 dark:text-gray-500 font-medium">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <Wrap>
      <Ionicons name="close-circle" size={56} color="#DC2626" />
      <Text className="text-lg font-serif-bold text-gray-900 dark:text-white mt-4 mb-1 text-center capitalize">Payment {checkout.status}</Text>
      <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">Your items have been released back to the shop. You can try again.</Text>
      {checkout.status === 'failed' && checkout.payment_method === 'mobile_money' && (
        <TouchableOpacity
          onPress={handleTryCod}
          disabled={codRetry?.submitting}
          className="bg-[#EAAD11] rounded-xl px-6 py-3 mb-3"
          style={{ opacity: codRetry?.submitting ? 0.6 : 1 }}
        >
          {codRetry?.submitting
            ? <ActivityIndicator color="#000" />
            : <Text className="text-black font-bold">Try Cash on Delivery instead</Text>}
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={() => router.replace('/cart')}>
        <Text className="text-sm text-gray-500 dark:text-gray-400 font-medium">Back to Cart</Text>
      </TouchableOpacity>
    </Wrap>
  );
}
