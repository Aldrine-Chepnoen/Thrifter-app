// Mobile port of frontend/src/components/Cart.jsx.
import { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useFeatures } from '@/hooks/use-features';
import { getImageSrc } from '@/lib/imageHost';
import api from '@/lib/api';

const formatUGX = (n: number) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
};

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { cartItems, loaded, removeFromCart, updateQuantity, clearCart } = useCart();
  const features = useFeatures();

  // Silently correct the cart against live stock on every visit, mirroring
  // the web cart's re-validation pass — checkout's own server-side check
  // remains the final authority regardless.
  useEffect(() => {
    if (!loaded || cartItems.length === 0) return;
    let cancelled = false;
    Promise.all(
      cartItems.map((item) =>
        api.get(`/items/${item.id}`)
          .then((res) => ({ id: item.id, quantity: res.data.quantity }))
          .catch(() => ({ id: item.id, quantity: 0 }))
      )
    ).then((results) => {
      if (cancelled) return;
      for (const { id, quantity } of results) {
        const cartItem = cartItems.find((i) => i.id === id);
        if (!cartItem) continue;
        if (quantity <= 0) removeFromCart(id);
        else if ((cartItem.cartQuantity || 1) > quantity) updateQuantity(id, quantity);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const subtotal = cartItems.reduce((sum, i) => sum + (Number(i.price) || 0) * (i.cartQuantity || 1), 0);
  const vendorCount = new Set(cartItems.map((i) => i.vendor_id)).size;
  const hasDeliveryFee = !!features;
  const deliveryFee = features
    ? (vendorCount > 1 ? features.delivery_fee_multi_vendor_ugx : features.delivery_fee_single_vendor_ugx)
    : 0;
  const total = subtotal + (hasDeliveryFee ? deliveryFee : 0);

  const handleCheckout = () => {
    if (!user) { router.push('/auth/login'); return; }
    router.push('/checkout');
  };

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="p-1 mr-3">
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900 flex-1">Your Cart</Text>
        {cartItems.length > 0 && (
          <TouchableOpacity onPress={clearCart}>
            <Text className="text-sm font-semibold text-[#EAAD11]">Remove all</Text>
          </TouchableOpacity>
        )}
      </View>

      {!loaded ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#EAAD11" size="large" />
        </View>
      ) : cartItems.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="bag-outline" size={48} color="#E5E7EB" />
          <Text className="text-gray-500 mt-3 mb-2">Your cart is empty.</Text>
          <TouchableOpacity onPress={() => router.push('/')}>
            <Text className="text-[#EAAD11] font-semibold text-sm">Continue browsing</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
            {cartItems.map((item) => (
              <View key={item.id} className="flex-row items-center gap-3 bg-gray-50 rounded-xl p-3 mb-3">
                <Image
                  source={{ uri: getImageSrc(item, 160) ?? '' }}
                  style={{ width: 64, height: 80, borderRadius: 10 }}
                  contentFit="cover"
                />
                <View className="flex-1">
                  <View className="flex-row items-start justify-between">
                    <Text className="font-semibold text-gray-900 flex-1 pr-2" numberOfLines={1}>{item.name}</Text>
                    <Text className="text-sm font-bold text-gray-900">{formatUGX(item.price)}</Text>
                  </View>
                  <Text className="text-sm text-gray-500">{item.vendor_name}</Text>
                  <Text className="text-sm text-gray-500">Size - <Text className="font-semibold text-gray-700">{item.size}</Text></Text>
                  {(item.quantity ?? 1) > 1 && (
                    <View className="flex-row items-center gap-2 mt-2">
                      <TouchableOpacity
                        onPress={() => updateQuantity(item.id, Math.max(1, (item.cartQuantity || 1) - 1))}
                        className="w-6 h-6 rounded-full bg-[#EAAD11] items-center justify-center"
                      >
                        <Text className="text-black font-bold">−</Text>
                      </TouchableOpacity>
                      <Text className="w-5 text-center text-sm font-semibold">{item.cartQuantity || 1}</Text>
                      <TouchableOpacity
                        onPress={() => updateQuantity(item.id, Math.min(item.quantity ?? 1, (item.cartQuantity || 1) + 1))}
                        className="w-6 h-6 rounded-full bg-gray-900 items-center justify-center"
                      >
                        <Text className="text-white font-bold">+</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => removeFromCart(item.id)} className="p-1">
                  <Ionicons name="close" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <View className="px-4 pt-3 pb-1 border-t border-gray-100">
            <View className="flex-row justify-between mb-1">
              <Text className="text-sm text-gray-500">Subtotal</Text>
              <Text className="text-sm text-gray-700">{formatUGX(subtotal)}</Text>
            </View>
            <View className="flex-row justify-between mb-1">
              <Text className="text-sm text-gray-500">Delivery fee</Text>
              <Text className="text-sm text-gray-700">{hasDeliveryFee ? formatUGX(deliveryFee) : '—'}</Text>
            </View>
            <View className="flex-row justify-between pt-2 mt-1 border-t border-gray-100">
              <Text className="font-semibold text-gray-900">Total</Text>
              <Text className="text-lg font-bold text-gray-900">{formatUGX(total)}</Text>
            </View>
          </View>

          <View className="px-4 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
            <TouchableOpacity
              onPress={handleCheckout}
              className="bg-[#EAAD11] rounded-xl py-4 items-center"
            >
              <Text className="text-black font-bold text-base">Checkout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}
