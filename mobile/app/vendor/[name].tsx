import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, ActivityIndicator,
  TouchableOpacity, Dimensions, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import ItemCard, { type Item } from '@/components/ItemCard';
import ReportModal from '@/components/ReportModal';
import { getImageSrc } from '@/lib/imageHost';
import api from '@/lib/api';

type VendorProfile = {
  id: number;
  name: string;
  item_count: number;
  banner_image?: string | null;
  banner_fallback_url?: string | null;
  description?: string | null;
  location?: string | null;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 12;
const GAP = 8;
const CARD_WIDTH = (SCREEN_WIDTH - H_PAD * 2 - GAP) / 2;
const BANNER_HEIGHT = 180;

export default function VendorScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);

  const isOwnStore =
    !!user?.is_vendor &&
    !!user?.vendor_name &&
    user.vendor_name.toLowerCase() === name?.toLowerCase();

  const fetchData = useCallback(async () => {
    if (!name) return;
    try {
      const [profileRes, itemsRes] = await Promise.all([
        api.get<VendorProfile>(`/vendors/${encodeURIComponent(name)}`),
        api.get<Item[]>('/items', { params: { vendor: name, limit: 100 } }),
      ]);
      setVendor(profileRes.data);
      setItems(itemsRes.data);
    } catch (e: any) {
      if (e?.response?.status === 404) setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reload when returning from upload or edit
  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  useEffect(() => {
    if (!user || !vendor || isOwnStore) {
      setBlocked(false);
      return;
    }
    api.get<{ vendor_id: number }[]>('/me/blocked-vendors')
      .then(({ data }) => setBlocked(data.some((b) => b.vendor_id === vendor.id)))
      .catch(() => {});
  }, [user, vendor, isOwnStore]);

  const toggleBlock = async () => {
    if (!vendor) return;
    setBlockBusy(true);
    try {
      if (blocked) {
        await api.delete(`/vendors/${vendor.id}/block`);
        setBlocked(false);
      } else {
        await api.post(`/vendors/${vendor.id}/block`);
        setBlocked(true);
      }
    } catch {
      Alert.alert('Error', 'Could not update. Please try again.');
    } finally {
      setBlockBusy(false);
    }
  };

  const openVendorMenu = () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    Alert.alert(vendor?.name ?? 'Vendor options', undefined, [
      { text: 'Report vendor', onPress: () => setReportOpen(true) },
      {
        text: blocked ? 'Unblock vendor' : 'Block vendor',
        style: blocked ? 'default' : 'destructive',
        onPress: toggleBlock,
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleDelete = (itemId: number) => {
    Alert.alert(
      'Delete item',
      'This will permanently remove the listing. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setItems((prev) => prev.filter((i) => i.id !== itemId));
            try {
              await api.delete(`/items/${itemId}`);
            } catch {
              fetchData();
            }
          },
        },
      ]
    );
  };

  const handleEdit = (itemId: number) => {
    router.push(`/edit/${itemId}`);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#EAAD11" size="large" />
      </View>
    );
  }

  if (notFound || !vendor) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8" style={{ paddingTop: insets.top }}>
        <Ionicons name="storefront-outline" size={52} color="#E5E7EB" />
        <Text className="text-gray-700 font-semibold mt-4">Store not found</Text>
        <TouchableOpacity className="mt-6" onPress={() => router.back()}>
          <Text className="text-[#EAAD11] font-semibold">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const bannerSrc = vendor.banner_image
    ? getImageSrc(
        { image_path: vendor.banner_image, fallback_url: vendor.banner_fallback_url },
        800,
      )
    : null;

  const ListHeader = (
    <View>
      {/* Banner */}
      {bannerSrc ? (
        <Image
          source={{ uri: bannerSrc }}
          style={{ width: SCREEN_WIDTH, height: BANNER_HEIGHT }}
          contentFit="cover"
        />
      ) : (
        <View style={{ width: SCREEN_WIDTH, height: 80 }} className="bg-gray-100" />
      )}

      {/* Vendor info */}
      <View className="px-4 py-4 bg-white border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">{vendor.name}</Text>
        {vendor.location ? (
          <View className="flex-row items-center gap-1 mt-1">
            <Ionicons name="location-outline" size={14} color="#9CA3AF" />
            <Text className="text-sm text-gray-400">{vendor.location}</Text>
          </View>
        ) : null}
        {vendor.description ? (
          <Text className="text-sm text-gray-500 mt-2 leading-relaxed">{vendor.description}</Text>
        ) : null}
        <Text className="text-xs text-gray-400 mt-2">
          {items.length} item{items.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <View style={{ height: H_PAD }} />
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50">
      {/* Back button */}
      <TouchableOpacity
        onPress={() => router.back()}
        className="absolute z-10 bg-white/90 rounded-full w-9 h-9 items-center justify-center"
        style={{ top: insets.top + 8, left: 16 }}
      >
        <Ionicons name="chevron-back" size={20} color="#111" />
      </TouchableOpacity>

      {/* Upload button — own store only */}
      {isOwnStore && (
        <TouchableOpacity
          onPress={() => router.push('/upload')}
          className="absolute z-10 bg-[#EAAD11] rounded-xl px-3 py-2 flex-row items-center gap-1"
          style={{ top: insets.top + 8, right: 16 }}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text className="text-white font-bold text-sm">Add Item</Text>
        </TouchableOpacity>
      )}

      {/* Report/block menu — everyone else's store */}
      {!isOwnStore && (
        <TouchableOpacity
          onPress={openVendorMenu}
          className="absolute z-10 bg-white/90 rounded-full w-9 h-9 items-center justify-center"
          style={{ top: insets.top + 8, right: 16 }}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#111" />
        </TouchableOpacity>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: H_PAD, paddingBottom: 32 }}
        columnWrapperStyle={{ gap: GAP }}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            cardWidth={CARD_WIDTH}
            onPress={(i) => router.push(`/item/${i.id}`)}
            onEdit={isOwnStore ? handleEdit : undefined}
            onRemove={isOwnStore ? handleDelete : undefined}
          />
        )}
        ListEmptyComponent={
          <View className="items-center py-16">
            <Ionicons name="shirt-outline" size={48} color="#E5E7EB" />
            <Text className="text-gray-400 mt-3 text-sm">
              {isOwnStore ? 'No listings yet — add your first item.' : 'No items listed yet.'}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {blocked && (
        <View
          className="absolute left-4 right-4 bg-gray-900/90 rounded-2xl px-4 py-3 flex-row items-center justify-between"
          style={{ bottom: insets.bottom + 16 }}
        >
          <Text className="text-white text-xs flex-1 mr-3">You&apos;ve blocked this vendor &mdash; their items won&apos;t show in your feed.</Text>
          <TouchableOpacity onPress={toggleBlock} disabled={blockBusy}>
            <Text className="text-[#EAAD11] text-xs font-bold">{blockBusy ? '…' : 'Unblock'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {vendor && (
        <ReportModal
          visible={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="vendor"
          targetId={vendor.id}
        />
      )}
    </View>
  );
}
