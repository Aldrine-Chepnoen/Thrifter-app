import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, RefreshControl,
  ActivityIndicator, Dimensions, TouchableOpacity,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import ItemCard, { type Item } from '@/components/ItemCard';
import api from '@/lib/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 12;
const GAP = 8;
const CARD_WIDTH = (SCREEN_WIDTH - H_PAD * 2 - GAP) / 2;

export default function WardrobeScreen() {
  const { user, loading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWardrobe = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await api.get<Item[]>('/wardrobe');
      setItems(data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  // Reload every time the tab is focused so saves from item detail reflect here
  useFocusEffect(useCallback(() => { fetchWardrobe(); }, [fetchWardrobe]));

  const onRefresh = () => { setRefreshing(true); fetchWardrobe(); };

  const handleRemove = async (itemId: number) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    try {
      await api.delete(`/wardrobe/${itemId}`);
    } catch {
      // restore item if the request failed
      fetchWardrobe();
    }
  };

  // ── Logged-out state ──────────────────────────────────────────────────────
  if (!authLoading && !user) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8" style={{ paddingTop: insets.top }}>
        <Ionicons name="heart-outline" size={52} color="#E5E7EB" />
        <Text className="text-xl font-bold text-gray-900 mt-4">Your Wardrobe</Text>
        <Text className="text-gray-400 text-center mt-2 text-sm">
          Sign in to save items and build your wardrobe
        </Text>
        <TouchableOpacity
          className="bg-[#EAAD11] rounded-xl py-4 w-full items-center mt-6"
          onPress={() => router.push('/auth/login')}
        >
          <Text className="text-white font-bold text-base">Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading && items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#EAAD11" size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <View className="bg-white border-b border-gray-100 px-4 py-3">
        <Text className="text-2xl font-bold text-gray-900">Wardrobe</Text>
        {items.length > 0 && (
          <Text className="text-xs text-gray-400 mt-0.5">{items.length} saved item{items.length !== 1 ? 's' : ''}</Text>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        contentContainerStyle={{ padding: H_PAD, paddingBottom: 24 }}
        columnWrapperStyle={{ gap: GAP }}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            cardWidth={CARD_WIDTH}
            onPress={(i) => router.push(`/item/${i.id}`)}
            onRemove={handleRemove}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#EAAD11" />
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-24">
            <Ionicons name="heart-outline" size={52} color="#E5E7EB" />
            <Text className="text-gray-700 font-semibold mt-4">Nothing saved yet</Text>
            <Text className="text-gray-400 text-sm mt-1 text-center">
              Tap the heart on any item to save it here
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
