import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '@/lib/api';

const ITEM_TYPES = [
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'dress', label: 'Dress / Jumpsuit' },
  { value: 'accessory', label: 'Accessory' },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="text-xs text-gray-500 font-medium mb-1">{label}</Text>
      {children}
    </View>
  );
}

export default function UploadScreen() {
  const insets = useSafeAreaInsets();
  const [images, setImages] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [size, setSize] = useState('');
  const [market, setMarket] = useState('');
  const [itemType, setItemType] = useState('top');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pickImages = async () => {
    const remaining = 3 - images.length;
    if (remaining <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
    });
    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 3));
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (images.length === 0) { Alert.alert('Required', 'Add at least one photo.'); return; }
    if (!name.trim()) { Alert.alert('Required', 'Item name is required.'); return; }
    if (!price.trim() || isNaN(Number(price))) { Alert.alert('Required', 'Enter a valid price.'); return; }
    if (!size.trim()) { Alert.alert('Required', 'Size is required.'); return; }
    if (!market.trim()) { Alert.alert('Required', 'Market is required.'); return; }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('price', price.trim());
      formData.append('size', size.trim());
      formData.append('market', market.trim());
      formData.append('item_type', itemType);
      if (description.trim()) formData.append('description', description.trim());

      images.forEach((uri) => {
        const filename = uri.split('/').pop() ?? 'photo.jpg';
        const ext = filename.split('.').pop()?.toLowerCase();
        formData.append('files', {
          uri,
          name: filename,
          type: ext === 'png' ? 'image/png' : 'image/jpeg',
        } as any);
      });

      await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert('Listed!', 'Your item is now live.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail ?? 'Upload failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="p-1 mr-3">
          <Ionicons name="close" size={22} color="#111" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900 flex-1">New Listing</Text>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          className="bg-[#EAAD11] rounded-xl px-4 py-2"
        >
          {submitting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text className="text-white font-bold">List Item</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        {/* Image picker */}
        <Field label="PHOTOS (up to 3) *">
          <View className="flex-row gap-3 flex-wrap">
            {images.map((uri, i) => (
              <View key={i} style={{ position: 'relative' }}>
                <Image
                  source={{ uri }}
                  style={{ width: 90, height: 90, borderRadius: 12 }}
                  contentFit="cover"
                />
                <TouchableOpacity
                  onPress={() => removeImage(i)}
                  style={{ position: 'absolute', top: -6, right: -6 }}
                  className="bg-gray-800 rounded-full w-5 h-5 items-center justify-center"
                >
                  <Ionicons name="close" size={10} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {images.length < 3 && (
              <TouchableOpacity
                onPress={pickImages}
                style={{ width: 90, height: 90 }}
                className="rounded-xl border-2 border-dashed border-gray-300 items-center justify-center"
              >
                <Ionicons name="camera-outline" size={24} color="#9CA3AF" />
                <Text className="text-xs text-gray-400 mt-1">Add photo</Text>
              </TouchableOpacity>
            )}
          </View>
        </Field>

        {/* Name */}
        <Field label="ITEM NAME *">
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
            placeholder="e.g. Floral Summer Dress"
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
            maxLength={120}
          />
        </Field>

        {/* Price */}
        <Field label="PRICE (UGX) *">
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
            placeholder="e.g. 25000"
            placeholderTextColor="#9CA3AF"
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
          />
        </Field>

        {/* Size + Market */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1">
            <Text className="text-xs text-gray-500 font-medium mb-1">SIZE *</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
              placeholder="e.g. M, 42, UK8"
              placeholderTextColor="#9CA3AF"
              value={size}
              onChangeText={setSize}
              maxLength={20}
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500 font-medium mb-1">MARKET *</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
              placeholder="e.g. Owino"
              placeholderTextColor="#9CA3AF"
              value={market}
              onChangeText={setMarket}
              maxLength={60}
            />
          </View>
        </View>

        {/* Category */}
        <Field label="CATEGORY">
          <View className="flex-row flex-wrap gap-2">
            {ITEM_TYPES.map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                onPress={() => setItemType(value)}
                className={`px-4 py-2 rounded-xl border ${
                  itemType === value
                    ? 'bg-[#EAAD11] border-[#EAAD11]'
                    : 'bg-white border-gray-200'
                }`}
              >
                <Text className={`text-sm font-medium ${itemType === value ? 'text-white' : 'text-gray-700'}`}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        {/* Description */}
        <Field label="DESCRIPTION (optional)">
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
            placeholder="Condition, style notes, etc."
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
            maxLength={500}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={{ minHeight: 80 }}
          />
        </Field>

        <View className="pb-10" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
