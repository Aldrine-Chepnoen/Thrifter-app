// Mobile port of frontend/src/components/Orders.jsx.
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '@/lib/api';
import { getImageSrc } from '@/lib/imageHost';

// Mirrors frontend/src/utils.js's ORDER_STATUS_LABELS.
const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  paid: 'Order placed',
  picked_up: 'On delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const formatUGX = (n: number) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
};

type OrderItemOut = {
  id: number;
  item_name_snapshot: string;
  price_at_purchase: number;
  quantity: number;
  image_path?: string | null;
  fallback_url?: string | null;
};
type OrderOut = { id: number; vendor_name?: string | null; status: string; items: OrderItemOut[] };
type CheckoutOut = { id: number; delivery_day: string; total_amount: number; orders: OrderOut[] };

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const [checkouts, setCheckouts] = useState<CheckoutOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<CheckoutOut[]>('/orders').then(({ data }) => setCheckouts(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <View className="flex-1 bg-white dark:bg-gray-900" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <TouchableOpacity onPress={() => router.back()} className="p-1 mr-3">
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text className="text-lg font-serif-bold text-gray-900 dark:text-white flex-1">My Orders</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#EAAD11" size="large" />
        </View>
      ) : checkouts.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="receipt-outline" size={48} color="#E5E7EB" />
          <Text className="text-gray-500 dark:text-gray-400 mt-3">No orders yet.</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
          {checkouts.map((c) => (
            <View key={c.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  Delivery: {new Date(c.delivery_day).toLocaleDateString('en-UG', { weekday: 'long', month: 'long', day: 'numeric' })}
                </Text>
                <Text className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatUGX(c.total_amount)}</Text>
              </View>
              {c.orders.map((order) => (
                <View key={order.id} className="mb-2">
                  <Text className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
                    {order.vendor_name} · {ORDER_STATUS_LABELS[order.status] || order.status}
                  </Text>
                  {order.items.map((oi) => (
                    <View key={oi.id} className="flex-row items-center gap-2 mb-1">
                      <Image
                        source={{ uri: getImageSrc(oi, 100) ?? '' }}
                        style={{ width: 36, height: 44, borderRadius: 6 }}
                        contentFit="cover"
                      />
                      <Text className="flex-1 text-sm text-gray-800 dark:text-gray-200">
                        {oi.item_name_snapshot}{oi.quantity > 1 ? ` × ${oi.quantity}` : ''} — {formatUGX(oi.price_at_purchase * (oi.quantity || 1))}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
