import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, RefreshControl,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ItemCard, { type Item } from '@/components/ItemCard';
import api from '@/lib/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 12;
const GAP = 8;
const CARD_WIDTH = (SCREEN_WIDTH - H_PAD * 2 - GAP) / 2;
const LIMIT = 20;

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const feedSeed = useRef((Math.random() * 2) - 1);
  const skipRef = useRef(0);
  const loadingMore = useRef(false);

  const [items, setItems] = useState<Item[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadItems = useCallback(async (reset = false) => {
    if (loadingMore.current && !reset) return;
    loadingMore.current = true;

    const skip = reset ? 0 : skipRef.current;
    try {
      const { data } = await api.get<Item[]>('/items', {
        params: { skip, limit: LIMIT, seed: feedSeed.current, sort: 'random' },
      });
      setItems((prev) => reset ? data : [...prev, ...data]);
      skipRef.current = skip + data.length;
      setHasMore(data.length === LIMIT);
    } catch {
      // keep current items on error
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadingMore.current = false;
    }
  }, []);

  useEffect(() => { loadItems(true); }, [loadItems]);

  const onRefresh = () => {
    feedSeed.current = (Math.random() * 2) - 1;
    setRefreshing(true);
    loadItems(true);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#EAAD11" size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <View className="bg-white border-b border-gray-100 px-4 py-3">
        <Text className="text-2xl font-bold text-gray-900">Thrifter</Text>
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
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#EAAD11" />
        }
        onEndReached={() => { if (hasMore) loadItems(false); }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          hasMore ? (
            <View className="py-6 items-center">
              <ActivityIndicator color="#EAAD11" />
            </View>
          ) : (
            <Text className="text-center text-gray-400 text-xs py-6">You've seen it all</Text>
          )
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
