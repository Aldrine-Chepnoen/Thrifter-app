import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, RefreshControl,
  ActivityIndicator, Dimensions, TouchableOpacity, Keyboard, Modal, ScrollView, Linking,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ItemCard, { type Item } from '@/components/ItemCard';
import HomeBanner from '@/components/HomeBanner';
import CartFloatingBar from '@/components/CartFloatingBar';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { getImageSrc } from '@/lib/imageHost';

type VendorSearchResult = {
  id: number;
  name: string;
  banner_image?: string | null;
  banner_fallback_url?: string | null;
  location?: string | null;
  item_count: number;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 12;
const GAP = 8;
const CARD_WIDTH = (SCREEN_WIDTH - H_PAD * 2 - GAP) / 2;
const LIMIT = 20;

const QUICK_TAGS = [
  { label: 'Jerseys', query: 'jersey' },
  { label: 'Shirts', query: 'shirt' },
  { label: 'Jeans', query: 'jeans' },
  { label: 'Sneakers', query: 'sneakers' },
  { label: 'Jackets', query: 'jacket' },
  { label: 'Hoodies', query: 'hoodie' },
  { label: 'Dresses', query: 'dress' },
  { label: 'Handbags', query: 'handbag' },
  { label: 'Accessories', query: 'accessories' },
];

const PRICE_BRACKETS: { label: string; min: number | null; max: number | null }[] = [
  { label: 'Under 10k', min: null, max: 10000 },
  { label: '10k – 20k', min: 10000, max: 20000 },
  { label: '20k – 50k', min: 20000, max: 50000 },
  { label: '50k – 100k', min: 50000, max: 100000 },
  { label: '100k – 200k', min: 100000, max: 200000 },
  { label: '200k+', min: 200000, max: null },
];

const CONTACT_LINKS = [
  { label: 'TikTok', icon: 'logo-tiktok' as const, url: 'https://www.tiktok.com/@thrifter_app?_r=1&_t=ZS-975gP5Z50Uf' },
  { label: 'Instagram', icon: 'logo-instagram' as const, url: 'https://www.instagram.com/thrifter.ug?igsh=OWRpa2h6dmRvYXUy' },
  { label: 'WhatsApp', icon: 'logo-whatsapp' as const, url: 'https://wa.me/256794185787' },
];
const LEGAL_LINKS = [
  { label: 'Terms & Conditions', url: 'https://thrifter-ug.com/terms-and-conditions' },
  { label: 'Privacy Policy', url: 'https://thrifter-ug.com/privacy-policy' },
];

type Sort = 'random' | 'for_you' | 'latest';
type PriceRange = { min: number | null; max: number | null } | null;

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showToast } = useToast();
  const themeColors = useThemeColors();
  const feedSeed = useRef((Math.random() * 2) - 1);
  const skipRef = useRef(0);
  const loadingMore = useRef(false);
  const listRef = useRef<FlatList>(null);

  // Feed state
  const [items, setItems] = useState<Item[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [feedLoading, setFeedLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Matches web: one of the two tabs is always the active selection (never
  // neither) — 'for_you' is the default, same as web's initial feedType.
  // Backend gracefully falls back to the random/seeded feed server-side for
  // logged-out users or anyone with an empty wardrobe, so this is safe to
  // default to regardless of auth state.
  const [sort, setSort] = useState<Sort>('for_you');
  const [priceRange, setPriceRange] = useState<PriceRange>(null);

  // Search state
  const [inputQuery, setInputQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Vendor typeahead — rides the same input as item search (mirrors web's
  // SearchBox: a matching vendor or two surfaces in a dropdown beneath the
  // bar as you type, while the item search above still runs as normal).
  // Visibility is derived, not a separate toggle tied to focus/blur — on a
  // touch device, hiding on blur would race the tap on a dropdown row itself
  // (blur fires before the press registers) and could swallow the tap.
  const [vendorResults, setVendorResults] = useState<VendorSearchResult[]>([]);

  // Image search state
  const [imageSearchActive, setImageSearchActive] = useState(false);
  const [imageResults, setImageResults] = useState<Item[]>([]);
  const [imageSearchLoading, setImageSearchLoading] = useState(false);

  // Wardrobe (heart) state
  const [wardrobeIds, setWardrobeIds] = useState<Set<number>>(new Set());

  // Filter sheet / contact dropdown
  const [filterOpen, setFilterOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const isSearchMode = submittedQuery.length > 0;
  const justSubmitted = useRef(false);

  // ── Wardrobe ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setWardrobeIds(new Set()); return; }
    api.get<Item[]>('/wardrobe')
      .then(({ data }) => setWardrobeIds(new Set(data.map((i) => i.id))))
      .catch(() => {});
  }, [user]);

  const handleAddToWardrobe = async (itemId: number, wasSaved: boolean) => {
    if (!user) { router.push('/auth/login'); throw new Error('not authed'); }
    try {
      if (wasSaved) {
        await api.delete(`/wardrobe/${itemId}`);
        setWardrobeIds((prev) => { const n = new Set(prev); n.delete(itemId); return n; });
      } else {
        await api.post(`/wardrobe/${itemId}`);
        setWardrobeIds((prev) => new Set(prev).add(itemId));
      }
    } catch {
      showToast('Could not update wardrobe.');
      throw new Error('failed');
    }
  };

  // ── Vendor typeahead ──────────────────────────────────────────────────────
  useEffect(() => {
    const trimmed = inputQuery.trim();
    if (trimmed.length < 2) {
      setVendorResults([]);
      return;
    }
    const handle = setTimeout(() => {
      api.get<VendorSearchResult[]>('/vendors/search', { params: { q: trimmed } })
        .then(({ data }) => setVendorResults(data))
        .catch(() => setVendorResults([]));
    }, 300);
    return () => clearTimeout(handle);
  }, [inputQuery]);

  const handleVendorPress = (name: string) => {
    setVendorResults([]);
    Keyboard.dismiss();
    router.push(`/vendor/${encodeURIComponent(name)}`);
  };

  // ── Feed ──────────────────────────────────────────────────────────────────
  const loadItems = useCallback(async (reset = false) => {
    if (loadingMore.current && !reset) return;
    loadingMore.current = true;
    const skip = reset ? 0 : skipRef.current;
    try {
      const { data } = await api.get<Item[]>('/items', {
        params: {
          skip, limit: LIMIT, seed: feedSeed.current, sort,
          min_price: priceRange?.min ?? undefined,
          max_price: priceRange?.max ?? undefined,
        },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, priceRange]);

  useEffect(() => { setFeedLoading(true); loadItems(true); }, [loadItems]);

  const onRefresh = () => {
    feedSeed.current = (Math.random() * 2) - 1;
    setRefreshing(true);
    loadItems(true);
  };

  const selectSort = (next: Sort) => {
    setImageSearchActive(false);
    clearSearch();
    setSort(next);
  };

  const hasActiveFilters = priceRange !== null;

  // ── Search ────────────────────────────────────────────────────────────────
  const runSearch = async (q: string) => {
    setImageSearchActive(false);
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

  const handleSearch = async () => {
    const q = inputQuery.trim();
    if (!q) return;
    justSubmitted.current = true;
    Keyboard.dismiss();
    setVendorResults([]);
    await runSearch(q);
  };

  const clearSearch = () => {
    setInputQuery('');
    setSubmittedQuery('');
    setSearchResults([]);
    setVendorResults([]);
  };

  // If user leaves the input without submitting, revert
  const handleBlur = () => {
    if (justSubmitted.current) {
      justSubmitted.current = false;
      return;
    }
    if (!submittedQuery) setInputQuery('');
  };

  const handleTagPress = (query: string) => {
    if (submittedQuery === query) {
      clearSearch();
    } else {
      setInputQuery(query);
      setVendorResults([]);
      runSearch(query);
    }
  };

  // ── Image search ──────────────────────────────────────────────────────────
  const handleImageSearch = async () => {
    if (!user) { router.push('/auth/login'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    clearSearch();
    setImageSearchActive(true);
    setImageSearchLoading(true);
    try {
      const formData = new FormData();
      const filename = asset.uri.split('/').pop() ?? 'photo.jpg';
      const ext = filename.split('.').pop()?.toLowerCase();
      formData.append('file', {
        uri: asset.uri,
        name: filename,
        type: ext === 'png' ? 'image/png' : 'image/jpeg',
      } as any);
      const { data } = await api.post<Item[]>('/outfit-search', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImageResults(data);
    } catch {
      showToast('Image search failed.');
      setImageSearchActive(false);
    } finally {
      setImageSearchLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const showSpinner = imageSearchActive ? imageSearchLoading : (isSearchMode ? searchLoading : feedLoading);
  const listData = imageSearchActive ? imageResults : (isSearchMode ? searchResults : items);

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-950" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 pt-3 pb-3">
        <View className="mb-3" style={{ position: 'relative' }}>
          <View className="items-center">
            <Image
              source={require('../../assets/images/logo-header.png')}
              style={{ width: 78, height: 44 }}
              contentFit="contain"
              accessibilityLabel="Thrifter"
            />
          </View>
          <TouchableOpacity
            onPress={() => setContactOpen(true)}
            className="p-1"
            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, justifyContent: 'center' }}
          >
            <Ionicons name="menu" size={22} color={themeColors.iconMuted} />
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center gap-2">
          <View style={{ flex: 1, position: 'relative' }}>
            <View className="flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-xl px-3 gap-2">
              <Ionicons name="search" size={18} color={themeColors.iconFaint} />
              <TextInput
                className="flex-1 py-3 text-base text-gray-900 dark:text-gray-100"
                placeholder="Search items, categories, or vendors..."
                placeholderTextColor={themeColors.iconFaint}
                value={inputQuery}
                onChangeText={setInputQuery}
                onSubmitEditing={handleSearch}
                onBlur={handleBlur}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {inputQuery.length > 0 ? (
                <TouchableOpacity onPress={clearSearch}>
                  <Ionicons name="close-circle" size={18} color={themeColors.iconFaint} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={handleImageSearch}>
                  <Ionicons name="camera-outline" size={19} color={themeColors.iconFaint} />
                </TouchableOpacity>
              )}
            </View>

            {/* Vendor typeahead dropdown */}
            {vendorResults.length > 0 && !isSearchMode && !imageSearchActive && (
              <View
                style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, zIndex: 50 }}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden"
              >
                <Text className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Vendors</Text>
                {vendorResults.map((v) => {
                  const thumb = (v.banner_image || v.banner_fallback_url)
                    ? getImageSrc({ image_path: v.banner_image, fallback_url: v.banner_fallback_url }, 64)
                    : null;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      onPress={() => handleVendorPress(v.name)}
                      className="flex-row items-center gap-3 px-4 py-2.5"
                    >
                      <View className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center overflow-hidden">
                        {thumb ? (
                          <Image source={{ uri: thumb }} style={{ width: 32, height: 32 }} contentFit="cover" />
                        ) : (
                          <Ionicons name="storefront-outline" size={14} color={themeColors.iconFaint} />
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-medium text-gray-800 dark:text-gray-100" numberOfLines={1}>{v.name}</Text>
                        <Text className="text-xs text-gray-400" numberOfLines={1}>
                          {v.item_count} item{v.item_count === 1 ? '' : 's'}{v.location ? ` · ${v.location}` : ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setFilterOpen(true)}
            className="relative p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full"
          >
            <Ionicons name="options-outline" size={18} color={hasActiveFilters ? themeColors.icon : themeColors.iconMuted} />
            {hasActiveFilters && <View className="absolute top-1 right-1 w-2 h-2 bg-[#EAAD11] rounded-full" />}
          </TouchableOpacity>
        </View>

        {/* Quick category chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3 -mb-1">
          <View className="flex-row gap-2">
            {QUICK_TAGS.map((tag) => {
              const active = submittedQuery === tag.query;
              return (
                <TouchableOpacity
                  key={tag.label}
                  onPress={() => handleTagPress(tag.query)}
                  className={`px-3 py-1 rounded-full border ${active ? 'bg-[#EAAD11] border-[#EAAD11]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}
                >
                  <Text className={`text-xs font-medium ${active ? 'text-black' : 'text-gray-600 dark:text-gray-400'}`}>{tag.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* For You / Latest tabs */}
        {!isSearchMode && !imageSearchActive && (
          <View className="flex-row justify-center gap-8 mt-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            {([{ key: 'for_you' as const, label: 'For You' }, { key: 'latest' as const, label: 'Latest' }]).map((tab) => (
              <TouchableOpacity key={tab.key} onPress={() => selectSort(tab.key)} className="pb-1">
                <Text className={`text-sm font-bold ${sort === tab.key ? 'text-black dark:text-white border-b-2 border-[#EAAD11] pb-1' : 'text-gray-400'}`}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {showSpinner ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#EAAD11" size="large" />
          {(isSearchMode || imageSearchActive) && (
            <Text className="text-gray-400 dark:text-gray-500 text-sm mt-3">Searching...</Text>
          )}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={listData}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2}
          contentContainerStyle={{ padding: H_PAD, paddingBottom: 100 }}
          columnWrapperStyle={{ gap: GAP }}
          ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
          renderItem={({ item }) => (
            <ItemCard
              item={item}
              cardWidth={CARD_WIDTH}
              onPress={(i) => router.push(`/item/${i.id}`)}
              onAddToWardrobe={handleAddToWardrobe}
              savedIds={wardrobeIds}
            />
          )}
          refreshControl={
            (isSearchMode || imageSearchActive) ? undefined : (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#EAAD11" />
            )
          }
          onEndReached={(isSearchMode || imageSearchActive) ? undefined : () => { if (hasMore) loadItems(false); }}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            imageSearchActive ? (
              <Text className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                {imageResults.length} visually similar result{imageResults.length !== 1 ? 's' : ''}
              </Text>
            ) : isSearchMode ? (
              <Text className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{submittedQuery}"
              </Text>
            ) : (
              <HomeBanner
                onExplore={() => listRef.current?.scrollToOffset({ offset: 220, animated: true })}
              />
            )
          }
          ListEmptyComponent={
            imageSearchActive ? (
              <View className="items-center justify-center py-20">
                <Ionicons name="image-outline" size={48} color="#E5E7EB" />
                <Text className="text-gray-700 dark:text-gray-300 font-semibold mt-3">No similar items found</Text>
              </View>
            ) : isSearchMode ? (
              <View className="items-center justify-center py-20">
                <Ionicons name="sad-outline" size={48} color="#E5E7EB" />
                <Text className="text-gray-700 dark:text-gray-300 font-semibold mt-3">No results for "{submittedQuery}"</Text>
                <Text className="text-gray-400 dark:text-gray-500 text-sm mt-1">Try different keywords</Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            !isSearchMode && !imageSearchActive && hasMore ? (
              <View className="py-6 items-center">
                <ActivityIndicator color="#EAAD11" />
              </View>
            ) : !isSearchMode && !imageSearchActive ? (
              <Text className="text-center text-gray-400 dark:text-gray-500 text-xs py-6">You've seen it all</Text>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Price filter sheet */}
      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <View className="flex-1 bg-black/40 justify-end">
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setFilterOpen(false)} />
          <View className="bg-white dark:bg-gray-900 rounded-t-2xl px-6 pt-4 pb-8">
            <View className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full self-center mb-5" />
            <View className="flex-row items-center justify-between mb-5">
              <View className="flex-row items-center gap-2">
                <Ionicons name="options-outline" size={16} color={themeColors.icon} />
                <Text className="font-bold text-base text-gray-900 dark:text-gray-100">Filter</Text>
              </View>
              <TouchableOpacity onPress={() => setFilterOpen(false)} className="p-1.5">
                <Ionicons name="close" size={18} color={themeColors.iconMuted} />
              </TouchableOpacity>
            </View>

            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300">Price Range (UGX)</Text>
              {priceRange !== null && (
                <TouchableOpacity onPress={() => setPriceRange(null)}>
                  <Text className="text-xs text-gray-400">Clear</Text>
                </TouchableOpacity>
              )}
            </View>
            <View className="flex-row flex-wrap gap-2 mb-6">
              {PRICE_BRACKETS.map((bracket) => {
                const active = priceRange?.min === bracket.min && priceRange?.max === bracket.max;
                return (
                  <TouchableOpacity
                    key={bracket.label}
                    onPress={() => setPriceRange(active ? null : { min: bracket.min, max: bracket.max })}
                    className={`px-4 py-2 rounded-full border ${active ? 'bg-[#EAAD11] border-[#EAAD11]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}
                  >
                    <Text className={`text-sm font-medium ${active ? 'text-black' : 'text-gray-600 dark:text-gray-400'}`}>{bracket.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={() => { setFilterOpen(false); setFeedLoading(true); loadItems(true); }}
              className="bg-black rounded-xl py-3 items-center"
            >
              <Text className="text-white font-bold text-sm">
                {priceRange ? `Show items · ${PRICE_BRACKETS.find((b) => b.min === priceRange.min && b.max === priceRange.max)?.label}` : 'Show all items'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Contact / socials dropdown */}
      <Modal visible={contactOpen} transparent animationType="fade" onRequestClose={() => setContactOpen(false)}>
        <TouchableOpacity className="flex-1 bg-black/20" activeOpacity={1} onPress={() => setContactOpen(false)}>
          <View style={{ marginTop: insets.top + 56, marginLeft: 12, width: 208 }}>
            <View className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
              <Text className="px-4 pt-3 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Find us on</Text>
              {CONTACT_LINKS.map((link) => (
                <TouchableOpacity
                  key={link.label}
                  onPress={() => { setContactOpen(false); Linking.openURL(link.url); }}
                  className="flex-row items-center gap-3 px-4 py-2.5"
                >
                  <Ionicons name={link.icon} size={16} color={themeColors.iconMuted} />
                  <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">{link.label}</Text>
                </TouchableOpacity>
              ))}
              {LEGAL_LINKS.map((link, i) => (
                <TouchableOpacity
                  key={link.label}
                  onPress={() => { setContactOpen(false); Linking.openURL(link.url); }}
                  className={`flex-row items-center gap-3 px-4 py-2.5 ${i === 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''}`}
                >
                  <Ionicons name="document-text-outline" size={16} color={themeColors.iconMuted} />
                  <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">{link.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <CartFloatingBar />
    </View>
  );
}
