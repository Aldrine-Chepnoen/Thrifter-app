// Mobile port of frontend/src/components/ItemCard.jsx — trimmed to what the
// feed/wardrobe grids actually use (no premium view/save-stats overlay yet,
// no is_hidden lock banner; those are vendor-premium extras, not needed for
// the app to render). Add back if/when those screens need them.
import React from 'react';
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
};

const formatUGX = (n: number) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
};

// ~half-screen tile x device pixel density -> ask for 400
const ItemCard = ({ item, cardWidth, onPress, onRemove, onEdit }: Props) => {
  const imgSrc = getImageSrc(item, 400);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(item)}
      style={{ width: cardWidth }}
    >
      <View className="rounded-xl overflow-hidden bg-gray-100" style={{ width: cardWidth, aspectRatio: 4 / 5 }}>
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
      <View className="mt-2 px-0.5">
        <Text className="font-medium text-gray-900" numberOfLines={1}>{item.name}</Text>
        {item.vendor_name && (
          <Text className="text-xs text-gray-500" numberOfLines={1}>{item.vendor_name}</Text>
        )}
        <Text className="text-sm font-semibold text-gray-900 mt-0.5">{formatUGX(item.price)}</Text>
      </View>
    </TouchableOpacity>
  );
};

export default ItemCard;
