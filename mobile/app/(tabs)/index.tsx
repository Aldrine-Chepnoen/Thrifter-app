import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, RefreshControl,
  ActivityIndicator, Dimensions, TouchableOpacity, Keyboard,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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

  // Feed state
  const [items, setItems] = useState<Item[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [feedLoading, setFeedLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search state
  const [inputQuery, setInputQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const isSearchMode = submittedQuery.length > 0;
  const justSubmitted = useRef(false);

  // ── Feed ──────────────────────────────────────────────────────────────────
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
    } catch {}
    finally {
      setFeedLoading(false);
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

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    const q = inputQuery.trim();
    if (!q) return;
    justSubmitted.current = true;
    Keyboard.dismiss();
    setSubmittedQuery(q);
    setSearchLoading(true);
    try {
      const { data } = await api.get<Item[]>('/search', { params: { query: q } });
      setSearchResults(data);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const clearSearch = () => {
    setInputQuery('');
    setSubmittedQuery('');
    setSearchResults([]);
  };

  // If user leaves the input without submitting, revert
  const handleBlur = () => {
    if (justSubmitted.current) {
      justSubmitted.current = false;
      return;
    }
    if (!submittedQuery) setInputQuery('');
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const showSpinner = isSearchMode ? searchLoading : feedLoading;

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white border-b border-gray-100 px-4 pt-3 pb-3">
        <Text className="text-2xl font-bold text-gray-900 mb-3">Thrifter</Text>
        <View className="flex-row items-center bg-gray-100 rounded-xl px-3 gap-2">
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            className="flex-1 py-3 text-base text-gray-900"
            placeholder="Search clothing..."
            placeholderTextColor="#9CA3AF"
            value={inputQuery}
            onChangeText={setInputQuery}
            onSubmitEditing={handleSearch}
            onBlur={handleBlur}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {inputQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {showSpinner ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#EAAD11" size="large" />
          {isSearchMode && (
            <Text className="text-gray-400 text-sm mt-3">Searching...</Text>
          )}
        </View>
      ) : (
        <FlatList
          data={isSearchMode ? searchResults : items}
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
            isSearchMode ? undefined : (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#EAAD11" />
            )
          }
          onEndReached={isSearchMode ? undefined : () => { if (hasMore) loadItems(false); }}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            isSearchMode ? (
              <Text className="text-xs text-gray-400 mb-3">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{submittedQuery}"
              </Text>
            ) : null
          }
          ListEmptyComponent={
            isSearchMode ? (
              <View className="items-center justify-center py-20">
                <Ionicons name="sad-outline" size={48} color="#E5E7EB" />
                <Text className="text-gray-700 font-semibold mt-3">No results for "{submittedQuery}"</Text>
                <Text className="text-gray-400 text-sm mt-1">Try different keywords</Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            !isSearchMode && hasMore ? (
              <View className="py-6 items-center">
                <ActivityIndicator color="#EAAD11" />
              </View>
            ) : !isSearchMode ? (
              <Text className="text-center text-gray-400 text-xs py-6">You've seen it all</Text>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
