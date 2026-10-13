// Mobile port of frontend/src/components/Cart.jsx. Promoted to a bottom tab
// (from a plain stack screen) so the cart stays reachable — and its item
// count visible via the tab bar badge — no matter which tab you're on;
// previously it only showed on the Home tab's header. Moving the file into
// the (tabs) route group doesn't change its URL (`/cart`), so the existing
// `router.push('/cart')` call sites elsewhere in the app keep working as-is.
import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
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

const NOTE_MAX_LENGTH = 200;
// How often to re-check live stock while the buyer stays on this screen — a
// one-time check on mount misses an item going unavailable mid-session.
const AVAILABILITY_POLL_MS = 20000;

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { cartItems, loaded, removeFromCart, updateQuantity, updateNote, clearCart } = useCart();
  const features = useFeatures();

  const [openNoteIds, setOpenNoteIds] = useState<Set<number>>(() => new Set());
  const [unavailableIds, setUnavailableIds] = useState<Set<number>>(() => new Set());
  const cartItemsRef = useRef(cartItems);
  useEffect(() => { cartItemsRef.current = cartItems; }, [cartItems]);

  useEffect(() => {
    if (!loaded) return;
    setOpenNoteIds((prev) => {
      const next = new Set(prev);
      for (const i of cartItems) if (i.cartNote) next.add(i.id);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const toggleNote = (itemId: number) => {
    setOpenNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  };

  useEffect(() => {
    if (!loaded || cartItems.length === 0) return;
    let cancelled = false;
    const checkAvailability = () => {
      const items = cartItemsRef.current;
      Promise.all(
        items.map((item) =>
          api.get(`/items/${item.id}`)
            .then((res) => ({ id: item.id, quantity: res.data.quantity }))
            .catch(() => ({ id: item.id, quantity: 0 }))
        )
      ).then((results) => {
        if (cancelled) return;
        const stillGone = new Set<number>();
        for (const { id, quantity } of results) {
          const cartItem = cartItemsRef.current.find((i) => i.id === id);
          if (!cartItem) continue;
          if (quantity <= 0) {
            stillGone.add(id);
          } else if ((cartItem.cartQuantity || 1) > quantity) {
            updateQuantity(id, quantity);
          }
        }
        setUnavailableIds(stillGone);
      });
    };
    checkAvailability();
    const interval = setInterval(checkAvailability, AVAILABILITY_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const hasUnavailable = cartItems.some((i) => unavailableIds.has(i.id));

  const subtotal = cartItems.reduce((sum, i) => sum + (Number(i.price) || 0) * (i.cartQuantity || 1), 0);
  // Delivery is distance-based and the buyer's location isn't known until
  // checkout — never show a number here, just note that it applies.
  const hasDeliveryFee = !!features;
  const tax = 0;
  const total = subtotal + tax;

  const handleCheckout = () => {
    if (hasUnavailable) return;
    if (!user) { router.push('/auth/login'); return; }
    router.push('/checkout');
  };

  return (
    <View className="flex-1 bg-white dark:bg-gray-900" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <Text className="text-lg font-serif-bold text-gray-900 dark:text-white flex-1">Your Cart</Text>
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
          <Text className="text-gray-500 dark:text-gray-400 mt-3 mb-2">Your cart is empty.</Text>
          <TouchableOpacity onPress={() => router.push('/')}>
            <Text className="text-[#EAAD11] font-semibold text-sm">Continue browsing</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {cartItems.map((item) => {
              const isUnavailable = unavailableIds.has(item.id);
              return (
                <View
                  key={item.id}
                  className={`flex-row items-start gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-3 mb-3 border ${isUnavailable ? 'border-red-200 dark:border-red-900' : 'border-transparent'}`}
                  style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 4 }}
                >
                  <Image
                    source={{ uri: getImageSrc(item, 160) ?? '' }}
                    style={{ width: 64, height: 80, borderRadius: 10, opacity: isUnavailable ? 0.5 : 1 }}
                    contentFit="cover"
                  />
                  <View className="flex-1">
                    <View className="flex-row items-start justify-between">
                      <Text className="font-semibold text-gray-900 dark:text-gray-100 flex-1 pr-2" numberOfLines={1}>{item.name}</Text>
                      <Text className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatUGX(item.price)}</Text>
                    </View>
                    <Text className="text-sm text-gray-500 dark:text-gray-400">{item.vendor_name}</Text>
                    <Text className="text-sm text-gray-500 dark:text-gray-400">Size - <Text className="font-semibold text-gray-700 dark:text-gray-300">{item.size}</Text></Text>

                    {isUnavailable ? (
                      <View className="flex-row items-center gap-1 mt-2">
                        <Ionicons name="alert-circle" size={14} color="#DC2626" />
                        <Text className="text-xs font-semibold text-red-600">No longer available — remove it to continue</Text>
                      </View>
                    ) : (
                      <>
                        {(item.quantity ?? 1) > 1 && (
                          <View className="flex-row items-center gap-2 mt-2">
                            <TouchableOpacity
                              onPress={() => updateQuantity(item.id, Math.max(1, (item.cartQuantity || 1) - 1))}
                              className="w-6 h-6 rounded-full bg-[#EAAD11] items-center justify-center"
                            >
                              <Text className="text-black font-bold">−</Text>
                            </TouchableOpacity>
                            <Text className="w-5 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">{item.cartQuantity || 1}</Text>
                            <TouchableOpacity
                              onPress={() => updateQuantity(item.id, Math.min(item.quantity ?? 1, (item.cartQuantity || 1) + 1))}
                              className="w-6 h-6 rounded-full bg-gray-900 dark:bg-gray-100 items-center justify-center"
                            >
                              <Text className="text-white dark:text-black font-bold">+</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {openNoteIds.has(item.id) ? (
                          <View className="mt-2">
                            <TextInput
                              className="text-sm p-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-lg text-gray-900 dark:text-gray-100"
                              value={item.cartNote || ''}
                              onChangeText={(t) => updateNote(item.id, t.slice(0, NOTE_MAX_LENGTH))}
                              onBlur={() => { if (!item.cartNote?.trim()) toggleNote(item.id); }}
                              placeholder="e.g. no perfume packaging, call before delivery…"
                              placeholderTextColor="#9CA3AF"
                              maxLength={NOTE_MAX_LENGTH}
                              multiline
                              numberOfLines={2}
                              textAlignVertical="top"
                              style={{ minHeight: 48 }}
                            />
                            <Text className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 text-right">
                              {(item.cartNote || '').length}/{NOTE_MAX_LENGTH}
                            </Text>
                          </View>
                        ) : (
                          <TouchableOpacity onPress={() => toggleNote(item.id)} className="flex-row items-center gap-1 mt-2">
                            <Ionicons name="chatbox-ellipses-outline" size={14} color="#EAAD11" />
                            <Text className="text-xs font-semibold text-[#EAAD11]">Add Order details (Size/Colors)?</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => removeFromCart(item.id)} className="p-1">
                    <Ionicons name="close" size={18} color={isUnavailable ? '#DC2626' : '#9CA3AF'} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>

          <View className="px-4 pt-3 pb-1 border-t border-gray-100 dark:border-gray-800">
            <View className="flex-row justify-between mb-1">
              <Text className="text-sm text-gray-500 dark:text-gray-400">Subtotal</Text>
              <Text className="text-sm text-gray-700 dark:text-gray-300">{formatUGX(subtotal)}</Text>
            </View>
            <View className="flex-row justify-between mb-1">
              <Text className="text-sm text-gray-500 dark:text-gray-400">Delivery fee</Text>
              <Text className="text-sm text-gray-700 dark:text-gray-300">{hasDeliveryFee ? 'Depends on delivery location' : '—'}</Text>
            </View>
            <View className="flex-row justify-between mb-1">
              <Text className="text-sm text-gray-500 dark:text-gray-400">Tax</Text>
              <Text className="text-sm text-gray-700 dark:text-gray-300">{formatUGX(tax)}</Text>
            </View>
            <View className="flex-row justify-between pt-2 mt-1 border-t border-gray-100 dark:border-gray-800">
              <Text className="font-semibold text-gray-900 dark:text-gray-100">Total</Text>
              <Text className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatUGX(total)}</Text>
            </View>
            {hasDeliveryFee && (
              <Text className="text-xs text-gray-400 dark:text-gray-500 pt-1">Delivery fee is calculated after you enter your delivery location at checkout.</Text>
            )}
          </View>

          <View className="px-4 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
            {hasUnavailable && (
              <View className="flex-row items-center gap-1.5 mb-3">
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text className="text-sm text-red-600 flex-1">
                  Remove the unavailable item{cartItems.filter((i) => unavailableIds.has(i.id)).length > 1 ? 's' : ''} above to continue.
                </Text>
              </View>
            )}
            <TouchableOpacity
              onPress={handleCheckout}
              disabled={hasUnavailable}
              className="bg-[#EAAD11] rounded-xl py-4 items-center"
              style={{ opacity: hasUnavailable ? 0.5 : 1 }}
            >
              <Text className="text-black font-bold text-base">Checkout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}
