// Mobile port of frontend/src/components/OrderConfirmation.jsx — polls
// GET /checkout/{id} until the payment resolves (webhook / verify()).
import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '@/lib/api';

type CheckoutStatus = { status: string; delivery_day: string };

export default function CheckoutCompleteScreen() {
  const { checkout_id } = useLocalSearchParams<{ checkout_id: string }>();
  const insets = useSafeAreaInsets();

  const [checkout, setCheckout] = useState<CheckoutStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!checkout_id) return;
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      try {
        const { data } = await api.get<CheckoutStatus>(`/checkout/${checkout_id}`);
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
  }, [checkout_id]);

  const Wrap = ({ children }: { children: React.ReactNode }) => (
    <View className="flex-1 bg-white items-center justify-center px-8" style={{ paddingTop: insets.top }}>
      {children}
    </View>
  );

  if (!checkout_id) {
    return (
      <Wrap>
        <Text className="text-gray-500 mb-4">No order to show.</Text>
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
        <Text className="text-lg font-bold text-gray-900 mt-4 mb-2 text-center">This is taking longer than usual</Text>
        <Text className="text-sm text-gray-500 text-center mb-6">
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
        <Text className="text-lg font-bold text-gray-900 mt-4 mb-1">Confirming your payment...</Text>
        <Text className="text-sm text-gray-500">This usually takes a few seconds.</Text>
      </Wrap>
    );
  }

  if (checkout.status === 'paid') {
    return (
      <Wrap>
        <Ionicons name="checkmark-circle" size={56} color="#16A34A" />
        <Text className="text-lg font-bold text-gray-900 mt-4 mb-1 text-center">Order confirmed!</Text>
        <Text className="text-sm text-gray-500 text-center mb-6">
          Delivery scheduled for {new Date(checkout.delivery_day).toLocaleDateString('en-UG', { weekday: 'long', month: 'long', day: 'numeric' })}.
        </Text>
        <TouchableOpacity onPress={() => router.replace('/orders')} className="bg-[#EAAD11] rounded-xl px-6 py-3">
          <Text className="text-black font-bold">View My Orders</Text>
        </TouchableOpacity>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <Ionicons name="close-circle" size={56} color="#DC2626" />
      <Text className="text-lg font-bold text-gray-900 mt-4 mb-1 text-center capitalize">Payment {checkout.status}</Text>
      <Text className="text-sm text-gray-500 text-center mb-6">Your items have been released back to the shop. You can try again.</Text>
      <TouchableOpacity onPress={() => router.replace('/cart')} className="bg-[#EAAD11] rounded-xl px-6 py-3">
        <Text className="text-black font-bold">Back to Cart</Text>
      </TouchableOpacity>
    </Wrap>
  );
}
