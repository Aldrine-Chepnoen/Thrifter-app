// Mobile port of frontend/src/components/ProductModal.jsx's content pane
// (ported here as a full screen rather than a modal). Owners get Edit/Delete;
// buyers get Add to Wardrobe + a stock-aware Add to Cart. The WhatsApp CTA
// that used to live here was removed on web when the cart/checkout system
// shipped — there is no WhatsApp button in the current buyer flow at all.
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Dimensions,
  ActivityIndicator, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { getImageSrc } from '@/lib/imageHost';
import api from '@/lib/api';
import { type Item } from '@/components/ItemCard';
import ReportModal from '@/components/ReportModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const formatUGX = (n: number) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
};

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { addToCart, isInCart } = useCart();
  const { showToast, confirmToast } = useToast();
  const insets = useSafeAreaInsets();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [savingWard, setSavingWard] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    api.get<Item>(`/items/${id}`)
      .then(({ data }) => setItem(data))
      .catch(() => showToast('Could not load item.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const images = item
    ? (item.images?.length ? item.images : [{ image_path: item.image_path, fallback_url: item.fallback_url, is_primary: true }])
    : [];

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setImgIndex(index);
  };

  const isOwner = !!(user?.is_vendor && user?.vendor_name && item?.vendor_name && user.vendor_name === item.vendor_name);

  const toggleWardrobe = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    setSavingWard(true);
    try {
      await api.post(`/wardrobe/${id}`);
      setSaved(true);
      showToast('Added to wardrobe', 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? 'Could not update wardrobe.');
    } finally {
      setSavingWard(false);
    }
  };

  const handleAddToCart = () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    if (item) addToCart(item, 1);
  };

  const handleEdit = () => {
    if (item) router.push(`/edit/${item.id}`);
  };

  const handleDelete = async () => {
    if (!item || deleting) return;
    const ok = await confirmToast('Delete this listing? This cannot be undone.', 'Delete');
    if (!ok) return;
    setDeleting(true);
    try {
      await api.delete(`/items/${item.id}`);
      router.back();
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? 'Failed to delete listing');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator color="#EAAD11" size="large" />
      </View>
    );
  }

  if (!item) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <Text className="text-gray-500 dark:text-gray-400">Item not found.</Text>
      </View>
    );
  }

  const unavailable = item.is_hidden || (item.status && item.status !== 'available');
  const unavailableLabel = item.is_hidden ? 'Unavailable' : item.status === 'sold' ? 'Sold' : 'Reserved';

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      {/* Image carousel */}
      <View style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.2 }}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
        >
          {images.map((img, i) => (
            <Image
              key={i}
              source={{ uri: getImageSrc(img, 800) ?? '' }}
              style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.2 }}
              contentFit="cover"
            />
          ))}
        </ScrollView>

        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ top: insets.top + 8 }}
          className="absolute left-4 bg-white/90 rounded-full w-9 h-9 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={20} color="#111" />
        </TouchableOpacity>

        {/* Dot indicators */}
        {images.length > 1 && (
          <View className="absolute bottom-3 w-full flex-row justify-center gap-1.5">
            {images.map((_, i) => (
              <View
                key={i}
                className={`rounded-full ${i === imgIndex ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'}`}
              />
            ))}
          </View>
        )}
      </View>

      {/* Details */}
      <ScrollView className="flex-1 px-5 pt-5" showsVerticalScrollIndicator={false}>
        <Text className="text-2xl font-serif-bold text-gray-900 dark:text-white leading-tight">{item.name}</Text>
        <Text className="text-xl font-bold text-[#EAAD11] mt-1">{formatUGX(item.price)}</Text>

        {/* Tags row */}
        <View className="flex-row flex-wrap gap-2 mt-3">
          {item.size ? (
            <View className="bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1">
              <Text className="text-xs text-gray-600 dark:text-gray-300 font-medium">Size {item.size}</Text>
            </View>
          ) : null}
          {item.item_type ? (
            <View className="bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1">
              <Text className="text-xs text-gray-600 dark:text-gray-300 font-medium capitalize">{item.item_type}</Text>
            </View>
          ) : null}
          {item.market ? (
            <View className="bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1">
              <Text className="text-xs text-gray-600 dark:text-gray-300 font-medium">{item.market}</Text>
            </View>
          ) : null}
        </View>

        {/* Description */}
        {item.description ? (
          <Text className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mt-4">{item.description}</Text>
        ) : null}

        {/* Vendor */}
        {item.vendor_name ? (
          <TouchableOpacity
            onPress={() => router.push(`/vendor/${encodeURIComponent(item.vendor_name!)}`)}
            className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex-row items-center"
          >
            <View className="flex-1">
              <Text className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Sold by</Text>
              <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">{item.vendor_name}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
          </TouchableOpacity>
        ) : null}

        {isOwner ? (
          <View className="mt-5 gap-3">
            <TouchableOpacity
              onPress={handleEdit}
              className="bg-[#25D366] rounded-2xl py-4 items-center flex-row justify-center gap-2"
            >
              <Ionicons name="pencil" size={18} color="#fff" />
              <Text className="text-white font-bold text-base">Edit Listing</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDelete}
              disabled={deleting}
              className="bg-red-600 rounded-2xl py-3.5 items-center"
              style={{ opacity: deleting ? 0.6 : 1 }}
            >
              {deleting
                ? <ActivityIndicator color="#fff" />
                : <Text className="text-white font-bold text-base">Delete Listing</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity
              onPress={toggleWardrobe}
              disabled={saved || savingWard}
              className="bg-black rounded-2xl py-3.5 items-center flex-row justify-center gap-2 mt-5"
              style={{ opacity: saved ? 0.6 : 1 }}
            >
              {savingWard
                ? <ActivityIndicator color="#fff" size="small" />
                : <Ionicons name={saved ? 'heart' : 'heart-outline'} size={18} color="#fff" />}
              <Text className="text-white font-bold text-base">{saved ? 'Saved to Wardrobe' : 'Add to Wardrobe'}</Text>
            </TouchableOpacity>

            {unavailable ? (
              <View className="bg-gray-300 dark:bg-gray-700 rounded-2xl py-4 items-center mt-3">
                <Text className="font-bold text-base text-gray-500 dark:text-gray-400">{unavailableLabel}</Text>
              </View>
            ) : isInCart(item.id) ? (
              <TouchableOpacity
                onPress={() => router.push('/cart')}
                className="bg-black rounded-2xl py-4 items-center flex-row justify-center gap-2 mt-3"
              >
                <Ionicons name="bag-check-outline" size={20} color="#fff" />
                <Text className="text-white font-bold text-base">In Cart — View Cart</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleAddToCart}
                className="bg-[#EAAD11] rounded-2xl py-4 items-center flex-row justify-center gap-2 mt-3"
              >
                <Ionicons name="bag-add-outline" size={20} color="#000" />
                <Text className="font-bold text-base text-black">Add to Cart</Text>
              </TouchableOpacity>
            )}

            {/* Report */}
            <TouchableOpacity
              onPress={() => (user ? setReportOpen(true) : router.push('/auth/login'))}
              className="flex-row items-center justify-center gap-1.5 py-4 mb-4"
            >
              <Ionicons name="flag-outline" size={15} color="#9CA3AF" />
              <Text className="text-xs text-gray-400 dark:text-gray-500 font-medium">Report this item</Text>
            </TouchableOpacity>
          </>
        )}

        <View className="pb-8" />
      </ScrollView>

      <ReportModal
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="item"
        targetId={item.id}
      />
    </View>
  );
}
