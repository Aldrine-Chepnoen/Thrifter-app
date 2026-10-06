// Always-present nudge (not time-based) shown whenever the cart has items —
// floats above the tab bar rather than taking header/feed space, so it stays
// visible regardless of scroll position. Taps go to /cart (review + the
// existing out-of-stock/availability checks there) rather than straight to
// /checkout.
import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '@/context/CartContext';

const formatUGX = (n: number) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
};

// Mirrors web's CartFloatingBar.jsx: redundant on the cart/checkout flow
// itself. Currently only mounted on the Feed tab, so this is a no-op there —
// kept so this component stays correct if it's ever added to another screen.
const HIDDEN_ON = ['/cart', '/checkout', '/checkout/complete'];

// Approximate default React Navigation bottom-tab-bar height (expo-router
// doesn't expose a stable public hook for the real rendered value) plus a
// small gap — close enough that the pill sits just above the tab bar on
// both platforms without needing an internal API.
const TAB_BAR_CLEARANCE = 36;

export default function CartFloatingBar() {
  const { cartItems, pulseKey } = useCart();
  const pathname = usePathname();
  const scale = useRef(new Animated.Value(1)).current;
  const count = cartItems.length;
  const total = cartItems.reduce((sum, i) => sum + (Number(i.price) || 0) * (i.cartQuantity || 1), 0);

  useEffect(() => {
    if (pulseKey === 0 || count === 0) return;
    scale.setValue(1);
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.04, useNativeDriver: true, speed: 30, bounciness: 10 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseKey]);

  if (count === 0 || HIDDEN_ON.includes(pathname)) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: TAB_BAR_CLEARANCE, alignItems: 'center' }}
    >
      <Animated.View style={{ transform: [{ scale }], width: '92%', maxWidth: 420 }}>
        <TouchableOpacity
          onPress={() => router.push('/cart')}
          activeOpacity={0.9}
          className="bg-black dark:bg-gray-800 rounded-2xl flex-row items-center px-4 py-3"
          style={{ shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}
        >
          <View className="w-8 h-8 rounded-full bg-[#EAAD11] items-center justify-center mr-3">
            <Ionicons name="bag" size={16} color="#000" />
          </View>
          <View className="flex-1">
            <Text className="text-white text-xs font-medium">{count} item{count !== 1 ? 's' : ''} · {formatUGX(total)}</Text>
            <Text className="text-white font-bold text-sm">Complete your order</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Text className="text-[#EAAD11] font-bold text-sm">Checkout</Text>
            <Ionicons name="arrow-forward" size={16} color="#EAAD11" />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
