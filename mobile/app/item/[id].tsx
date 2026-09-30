import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Dimensions,
  ActivityIndicator, Alert, Linking, NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
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
  const insets = useSafeAreaInsets();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [savingWard, setSavingWard] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    api.get<Item>(`/items/${id}`)
      .then(({ data }) => setItem(data))
      .catch(() => Alert.alert('Error', 'Could not load item.'))
      .finally(() => setLoading(false));
  }, [id]);

  const images = item
    ? (item.images?.length ? item.images : [{ image_path: item.image_path, fallback_url: item.fallback_url, is_primary: true }])
    : [];

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setImgIndex(index);
  };

  const toggleWardrobe = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    setSavingWard(true);
    try {
      if (saved) {
        await api.delete(`/wardrobe/${id}`);
        setSaved(false);
      } else {
        await api.post(`/wardrobe/${id}`);
        setSaved(true);
      }
    } catch {
      Alert.alert('Error', 'Could not update wardrobe.');
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

  const openWhatsApp = (number: string) => {
    const cleaned = number.replace(/\D/g, '');
    Linking.openURL(`https://wa.me/${cleaned}`).catch(() =>
      Alert.alert('WhatsApp not found', 'Could not open WhatsApp.')
    );
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#EAAD11" size="large" />
      </View>
    );
  }

  if (!item) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500">Item not found.</Text>
      </View>
    );
  }

  const whatsapp = item.vendor_whatsapp ?? (item as any).whatsapp;

  return (
    <View className="flex-1 bg-white">
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

        {/* Save button */}
        <TouchableOpacity
          onPress={toggleWardrobe}
          disabled={savingWard}
          style={{ top: insets.top + 8 }}
          className="absolute right-4 bg-white/90 rounded-full w-9 h-9 items-center justify-center"
        >
          <Ionicons
            name={saved ? 'heart' : 'heart-outline'}
            size={20}
            color={saved ? '#EAAD11' : '#111'}
          />
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
        <Text className="text-2xl font-bold text-gray-900 leading-tight">{item.name}</Text>
        <Text className="text-xl font-bold text-[#EAAD11] mt-1">{formatUGX(item.price)}</Text>

        {/* Tags row */}
        <View className="flex-row flex-wrap gap-2 mt-3">
          {item.size ? (
            <View className="bg-gray-100 rounded-full px-3 py-1">
              <Text className="text-xs text-gray-600 font-medium">Size {item.size}</Text>
            </View>
          ) : null}
          {item.item_type ? (
            <View className="bg-gray-100 rounded-full px-3 py-1">
              <Text className="text-xs text-gray-600 font-medium capitalize">{item.item_type}</Text>
            </View>
          ) : null}
          {item.market ? (
            <View className="bg-gray-100 rounded-full px-3 py-1">
              <Text className="text-xs text-gray-600 font-medium">{item.market}</Text>
            </View>
          ) : null}
        </View>

        {/* Description */}
        {item.description ? (
          <Text className="text-gray-600 text-sm leading-relaxed mt-4">{item.description}</Text>
        ) : null}

        {/* Vendor */}
        {item.vendor_name ? (
          <TouchableOpacity
            onPress={() => router.push(`/vendor/${encodeURIComponent(item.vendor_name!)}`)}
            className="mt-4 pt-4 border-t border-gray-100 flex-row items-center"
          >
            <View className="flex-1">
              <Text className="text-xs text-gray-400 uppercase tracking-wide mb-1">Sold by</Text>
              <Text className="text-base font-semibold text-gray-900">{item.vendor_name}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
          </TouchableOpacity>
        ) : null}

        {/* Add to Cart */}
        {(item.quantity ?? 1) > 0 && (
          <TouchableOpacity
            onPress={handleAddToCart}
            disabled={isInCart(item.id)}
            className={`rounded-2xl py-4 items-center flex-row justify-center gap-2 mt-5 ${isInCart(item.id) ? 'bg-gray-100' : 'bg-[#EAAD11]'}`}
          >
            <Ionicons name={isInCart(item.id) ? 'checkmark' : 'bag-add-outline'} size={20} color={isInCart(item.id) ? '#6B7280' : '#000'} />
            <Text className={`font-bold text-base ${isInCart(item.id) ? 'text-gray-500' : 'text-black'}`}>
              {isInCart(item.id) ? 'In Cart' : 'Add to Cart'}
            </Text>
          </TouchableOpacity>
        )}

        {/* WhatsApp CTA */}
        {whatsapp ? (
          <TouchableOpacity
            onPress={() => openWhatsApp(whatsapp)}
            className="bg-[#25D366] rounded-2xl py-4 items-center flex-row justify-center gap-2 mt-5"
          >
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            <Text className="text-white font-bold text-base">Contact on WhatsApp</Text>
          </TouchableOpacity>
        ) : null}

        {/* Report */}
        <TouchableOpacity
          onPress={() => (user ? setReportOpen(true) : router.push('/auth/login'))}
          className="flex-row items-center justify-center gap-1.5 py-4 mb-8"
        >
          <Ionicons name="flag-outline" size={15} color="#9CA3AF" />
          <Text className="text-xs text-gray-400 font-medium">Report this item</Text>
        </TouchableOpacity>
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
