// Mobile port of frontend/src/components/Checkout.jsx. One difference from
// web: payCheckout's redirect_url is just the web app's own confirmation
// page (mobile money has no real hosted checkout — Nylon Pay pushes a PIN
// prompt straight to the buyer's phone), so there's nothing to open in a
// browser here — just navigate straight to our own polling screen.
import { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '@/context/CartContext';
import { useFeatures } from '@/hooks/use-features';
import { useToast } from '@/context/ToastContext';
import { getImageSrc } from '@/lib/imageHost';
import LocationInput from '@/components/LocationInput';
import api from '@/lib/api';
import { useRef, useEffect } from 'react';

const formatUGX = (n: number) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
};

// Mirrors the backend's _calculate_delivery_fee (backend/main.py) — kept in
// sync manually so the preview matches what /checkout actually charges.
const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const r = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lng2 - lng1);
  const a = Math.sin(dPhi / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLambda / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
};

type CheckoutOut = {
  id: number;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  payment_method: string;
  orders: { items: { id: number; item_name_snapshot: string; price_at_purchase: number; quantity: number }[] }[];
};

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const { cartItems, clearCart } = useCart();
  const features = useFeatures();
  const { showToast } = useToast();

  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [checkout, setCheckout] = useState<CheckoutOut | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'mobile_money' | 'cash_on_delivery'>('mobile_money');
  const [submitting, setSubmitting] = useState(false);
  const confirmedRef = useRef(false);

  // Release held stock if the buyer backs out of the confirm step without
  // paying/confirming — best-effort, mirrors Checkout.jsx's beforeunload
  // handler (mobile has no tab-close equivalent to also cover).
  useEffect(() => {
    if (step !== 'confirm' || !checkout) return;
    return () => {
      if (confirmedRef.current) return;
      api.post(`/checkout/${checkout.id}/cancel`).catch(() => {});
    };
  }, [step, checkout]);

  const subtotal = cartItems.reduce((sum, i) => sum + (Number(i.price) || 0) * (i.cartQuantity || 1), 0);

  const hasFeeConfig = !!features;
  const locationResolved = deliveryLat != null && deliveryLng != null;
  const distanceKm = (hasFeeConfig && locationResolved)
    ? haversineKm(features!.collection_point_lat, features!.collection_point_lng, deliveryLat!, deliveryLng!)
    : null;
  const outOfRange = distanceKm != null && features?.delivery_max_radius_km != null && distanceKm > features.delivery_max_radius_km;
  const hasDeliveryFee = hasFeeConfig && locationResolved && !outOfRange;
  const rawDeliveryFee = hasDeliveryFee ? features!.delivery_base_fee_ugx + features!.delivery_rate_per_km_ugx * distanceKm! : 0;
  const deliveryFee = hasDeliveryFee
    ? (paymentMethod === 'cash_on_delivery' && features!.cod_rounding_ugx
        ? Math.ceil(rawDeliveryFee / features!.cod_rounding_ugx) * features!.cod_rounding_ugx
        : Math.round(rawDeliveryFee))
    : 0;
  const total = subtotal + (hasDeliveryFee ? deliveryFee : 0);

  if (cartItems.length === 0 && step === 'form') {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900 px-8" style={{ paddingTop: insets.top }}>
        <Text className="text-gray-500 dark:text-gray-400">Your cart is empty.</Text>
      </View>
    );
  }

  const handleCreateCheckout = async () => {
    if (!name.trim() || !phone.trim() || !address.trim()) {
      showToast('Please fill in all delivery details.', 'error');
      return;
    }
    if (!locationResolved) {
      showToast('Please confirm your delivery location — select a suggestion or use your location.', 'error');
      return;
    }
    if (outOfRange) {
      showToast("Sorry, we don't deliver that far yet.", 'error');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post<CheckoutOut>('/checkout', {
        items: cartItems.map((i) => ({ item_id: i.id, quantity: i.cartQuantity || 1, note: i.cartNote?.trim() || undefined })),
        delivery_name: name.trim(),
        delivery_phone: phone.trim(),
        delivery_address: address.trim(),
        delivery_lat: deliveryLat,
        delivery_lng: deliveryLng,
        payment_method: paymentMethod,
      });
      setCheckout(data);
      setStep('confirm');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail && typeof detail === 'object' && Array.isArray(detail.items)) {
        const lines = detail.items.map((s: any) => {
          const item = cartItems.find((i) => i.id === s.item_id);
          const itemName = item?.name || `Item #${s.item_id}`;
          return s.available > 0
            ? `${itemName}: only ${s.available} left (you requested ${s.requested})`
            : `${itemName} is no longer available`;
        });
        showToast(lines.join('; '), 'error');
      } else {
        const msg = typeof detail === 'object' ? detail.message : detail;
        showToast(msg || err?.message || 'Checkout failed, please try again.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPay = async () => {
    if (!checkout) return;
    confirmedRef.current = true;
    setSubmitting(true);
    try {
      await api.post(`/checkout/${checkout.id}/pay`, { provider: 'nylon' });
      clearCart();
      router.replace(`/checkout/complete?checkout_id=${checkout.id}`);
    } catch (err: any) {
      confirmedRef.current = false;
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'object' ? detail.message : detail;
      showToast(msg || err?.message || 'Could not start payment, please try again.', 'error');
      setSubmitting(false);
    }
  };

  const handleConfirmCod = async () => {
    if (!checkout) return;
    confirmedRef.current = true;
    setSubmitting(true);
    try {
      await api.post(`/checkout/${checkout.id}/confirm-cod`);
      clearCart();
      router.replace(`/checkout/complete?checkout_id=${checkout.id}`);
    } catch (err: any) {
      confirmedRef.current = false;
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'object' ? detail.message : detail;
      showToast(msg || err?.message || 'Could not place your order, please try again.', 'error');
      setSubmitting(false);
    }
  };

  const isCod = checkout?.payment_method === 'cash_on_delivery';

  if (step === 'confirm' && checkout) {
    return (
      <View className="flex-1 bg-white dark:bg-gray-900" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <TouchableOpacity onPress={() => router.back()} className="p-1 mr-3">
            <Ionicons name="arrow-back" size={22} color="#111" />
          </TouchableOpacity>
          <Text className="text-lg font-serif-bold text-gray-900 dark:text-white flex-1">Confirm your order</Text>
        </View>

        <ScrollView className="flex-1 px-4 pt-4">
          {checkout.orders.flatMap((o) => o.items).map((oi) => (
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
              <Text className="text-sm text-gray-700 dark:text-gray-300">{formatUGX(checkout.subtotal)}</Text>
            </View>
            <View className="flex-row justify-between mb-1">
              <Text className="text-sm text-gray-500 dark:text-gray-400">Delivery fee</Text>
              <Text className="text-sm text-gray-700 dark:text-gray-300">{formatUGX(checkout.delivery_fee)}</Text>
            </View>
            <View className="flex-row justify-between mb-1">
              <Text className="text-sm text-gray-500 dark:text-gray-400">Tax</Text>
              <Text className="text-sm text-gray-700 dark:text-gray-300">{formatUGX(0)}</Text>
            </View>
            <View className="flex-row justify-between pt-2 mt-1 border-t border-gray-100 dark:border-gray-800">
              <Text className="font-semibold text-gray-900 dark:text-gray-100">Total</Text>
              <Text className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatUGX(checkout.total_amount)}</Text>
            </View>
          </View>

          {features && (
            <Text className="text-xs text-gray-400 dark:text-gray-500 mt-4">
              {isCod
                ? `Confirm within ${features.reservation_minutes} minutes — after that these items go back into stock.`
                : `Complete payment within ${features.reservation_minutes} minutes — after that these items go back into stock.`}
            </Text>
          )}
        </ScrollView>

        <View className="px-4 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          <TouchableOpacity
            onPress={isCod ? handleConfirmCod : handleConfirmPay}
            disabled={submitting}
            className="bg-[#EAAD11] rounded-xl py-4 items-center"
            style={{ opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text className="text-black font-bold text-base">
                {isCod ? 'Place order — pay on delivery' : 'Confirm & Pay'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-gray-900"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ paddingTop: insets.top }}
    >
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <TouchableOpacity onPress={() => router.back()} className="p-1 mr-3">
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text className="text-lg font-serif-bold text-gray-900 dark:text-white flex-1">Checkout</Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {cartItems.map((item) => (
          <View key={item.id} className="flex-row items-center gap-3 mb-2">
            <Image source={{ uri: getImageSrc(item, 100) ?? '' }} style={{ width: 40, height: 48, borderRadius: 8 }} contentFit="cover" />
            <Text className="flex-1 text-sm text-gray-700 dark:text-gray-300" numberOfLines={1}>
              {item.name}{(item.cartQuantity ?? 1) > 1 ? ` × ${item.cartQuantity}` : ''}
            </Text>
            <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatUGX(item.price * (item.cartQuantity || 1))}</Text>
          </View>
        ))}
        <View className="pt-3 mt-2 border-t border-gray-100 dark:border-gray-800 mb-5">
          <View className="flex-row justify-between mb-1">
            <Text className="text-sm text-gray-500 dark:text-gray-400">Subtotal</Text>
            <Text className="text-sm text-gray-700 dark:text-gray-300">{formatUGX(subtotal)}</Text>
          </View>
          <View className="flex-row justify-between mb-1">
            <Text className="text-sm text-gray-500 dark:text-gray-400">Shipping Cost</Text>
            <Text className="text-sm text-gray-700 dark:text-gray-300">
              {hasDeliveryFee
                ? formatUGX(deliveryFee)
                : (outOfRange ? 'Not available at this location' : 'Set delivery location to see cost')}
            </Text>
          </View>
          <View className="flex-row justify-between mb-1">
            <Text className="text-sm text-gray-500 dark:text-gray-400">Tax</Text>
            <Text className="text-sm text-gray-700 dark:text-gray-300">{formatUGX(0)}</Text>
          </View>
          <View className="flex-row justify-between pt-2 mt-1 border-t border-gray-100 dark:border-gray-800">
            <Text className="font-semibold text-gray-900 dark:text-gray-100">Total</Text>
            <Text className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatUGX(total)}</Text>
          </View>
        </View>

        <Text className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">FULL NAME *</Text>
        <TextInput
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 text-base mb-4"
          value={name}
          onChangeText={setName}
        />

        <Text className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">PHONE NUMBER *</Text>
        <TextInput
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 text-base mb-4"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <Text className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">PAYMENT METHOD *</Text>
        <View className="flex-row gap-3 mb-4">
          {([
            { value: 'mobile_money' as const, label: 'Mobile Money', hint: 'Pay now via PIN prompt' },
            { value: 'cash_on_delivery' as const, label: 'Cash on Delivery', hint: 'Pay when it arrives' },
          ]).map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setPaymentMethod(opt.value)}
              className={`flex-1 px-3 py-2.5 rounded-xl border ${
                paymentMethod === opt.value ? 'border-[#EAAD11] bg-[#EAAD11]/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              <Text className="font-semibold text-sm text-gray-900 dark:text-gray-100">{opt.label}</Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">{opt.hint}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">DELIVERY ADDRESS *</Text>
        <LocationInput
          address={address}
          lat={deliveryLat}
          lng={deliveryLng}
          onChange={({ address: a, lat: la, lng: ln }) => { setAddress(a); setDeliveryLat(la); setDeliveryLng(ln); }}
        />
        {outOfRange && (
          <Text className="text-sm text-red-600 mt-1.5">Sorry, we don't deliver that far yet.</Text>
        )}

        <TouchableOpacity
          onPress={handleCreateCheckout}
          disabled={submitting || outOfRange}
          className="bg-[#EAAD11] rounded-xl py-4 items-center mb-8 mt-4"
          style={{ opacity: submitting ? 0.6 : 1 }}
        >
          {submitting ? <ActivityIndicator color="#000" /> : <Text className="text-black font-bold text-base">Continue</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
