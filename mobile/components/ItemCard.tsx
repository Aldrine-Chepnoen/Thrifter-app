// Mobile port of frontend/src/components/ItemCard.jsx — trimmed to what the
// feed/wardrobe grids actually use (no premium view/save-stats overlay yet,
// no is_hidden lock banner; those are vendor-premium extras, not needed for
// the app to render). Add back if/when those screens need them.
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { getImageSrc } from '@/lib/imageHost';

export type Item = {
  id: number;
  name: string;
  price: number;
  size?: string;
  market?: string | null;
  item_type?: string | null;
  description?: string | null;
  vendor_id?: number | null;
  vendor_name?: string | null;
  vendor_whatsapp?: string | null;
  whatsapp?: string | null;
  quantity?: number;
  image_path?: string | null;
  cloudinary_public_id?: string | null;
  fallback_url?: string | null;
  images?: { id: number; image_path: string; fallback_url?: string | null; is_primary: boolean }[];
  status?: string;
  is_hidden?: boolean;
};

type Props = {
  item: Item;
  cardWidth: number;
  onPress: (item: Item) => void;
  onRemove?: (itemId: number) => void;
  onEdit?: (itemId: number) => void;
  // Wardrobe heart — only rendered when onAddToWardrobe is passed AND
  // onRemove is not (mutually exclusive with the edit/remove overlay, same
  // as web's ItemCard.jsx: the Wardrobe screen itself gets a remove
  // affordance instead of a heart it would always show as already-saved).
  onAddToWardrobe?: (itemId: number, wasSaved: boolean) => Promise<void> | void;
  savedIds?: Set<number>;
};

const formatUGX = (n: number) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
};

// ~half-screen tile x device pixel density -> ask for 400
const ItemCard = ({ item, cardWidth, onPress, onRemove, onEdit, onAddToWardrobe, savedIds }: Props) => {
  const imgSrc = getImageSrc(item, 400);
  const [saved, setSaved] = useState(() => savedIds?.has(item.id) ?? false);

  // savedIds often arrives after this card has already mounted (the
  // Wardrobe fetch that populates it on the Feed/vendor screens resolves
  // async) — a plain lazy-initializer wouldn't ever pick up that later
  // value, leaving an already-saved item's heart stuck empty until manually
  // toggled. Re-sync whenever the prop changes.
  useEffect(() => {
    setSaved(savedIds?.has(item.id) ?? false);
  }, [savedIds, item.id]);

  const toggleWardrobe = () => {
    if (!onAddToWardrobe) return;
    const wasSaved = saved;
    setSaved(!wasSaved);
    Promise.resolve(onAddToWardrobe(item.id, wasSaved)).catch(() => setSaved(wasSaved));
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(item)}
      style={{ width: cardWidth }}
    >
      <View
        className="rounded-xl bg-white dark:bg-gray-800"
        style={{
          width: cardWidth,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 4,
        }}
      >
        <View
          className="rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 border border-[#EAAD11]"
          style={{ aspectRatio: 4 / 5 }}
        >
          <Image
            source={imgSrc ? { uri: imgSrc } : undefined}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={150}
          />
          {(onEdit || onRemove) && (
            <View className="absolute top-2 right-2 flex-row gap-1.5">
              {onEdit && (
                <TouchableOpacity
                  onPress={() => onEdit(item.id)}
                  className="bg-white/90 rounded-full w-7 h-7 items-center justify-center"
                >
                  <Ionicons name="pencil" size={13} color="#111827" />
                </TouchableOpacity>
              )}
              {onRemove && (
                <TouchableOpacity
                  onPress={() => onRemove(item.id)}
                  className="bg-white/90 rounded-full w-7 h-7 items-center justify-center"
                >
                  <Ionicons name="trash" size={13} color="#DC2626" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
      <View className="mt-2 px-0.5 relative">
        {onAddToWardrobe && !onRemove && (
          <TouchableOpacity
            onPress={toggleWardrobe}
            className="absolute top-0 right-0 p-1 z-10"
          >
            <Ionicons
              name={saved ? 'heart' : 'heart-outline'}
              size={16}
              color={saved ? '#EAAD11' : '#9CA3AF'}
            />
          </TouchableOpacity>
        )}
        <Text className="font-medium text-gray-900 dark:text-gray-100 pr-5" numberOfLines={1}>{item.name}</Text>
        {item.vendor_name && (
          <Text className="text-xs text-gray-500 dark:text-gray-400" numberOfLines={1}>{item.vendor_name}</Text>
        )}
        <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-0.5">{formatUGX(item.price)}</Text>
      </View>
    </TouchableOpacity>
  );
};

export default ItemCard;
