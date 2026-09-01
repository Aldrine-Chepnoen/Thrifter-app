import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '@/lib/api';
import { type Item } from '@/components/ItemCard';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="text-xs text-gray-500 font-medium mb-1">{label}</Text>
      {children}
    </View>
  );
}

export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [size, setSize] = useState('');
  const [market, setMarket] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    api.get<Item>(`/items/${id}`)
      .then(({ data }) => {
        setName(data.name);
        setPrice(String(data.price));
        setSize(data.size ?? '');
        setMarket(data.market ?? '');
        setDescription(data.description ?? '');
      })
      .catch(() => Alert.alert('Error', 'Could not load item.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
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
      if (description.trim()) formData.append('description', description.trim());

      await api.put(`/items/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail ?? 'Could not save changes.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#EAAD11" size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="p-1 mr-3">
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900 flex-1">Edit Listing</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={submitting}
          className="bg-[#EAAD11] rounded-xl px-4 py-2"
        >
          {submitting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text className="text-white font-bold">Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        <Field label="ITEM NAME *">
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
            value={name}
            onChangeText={setName}
            maxLength={120}
          />
        </Field>

        <Field label="PRICE (UGX) *">
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
          />
        </Field>

        <View className="flex-row gap-3 mb-4">
          <View className="flex-1">
            <Text className="text-xs text-gray-500 font-medium mb-1">SIZE *</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
              value={size}
              onChangeText={setSize}
              maxLength={20}
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500 font-medium mb-1">MARKET *</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
              value={market}
              onChangeText={setMarket}
              maxLength={60}
            />
          </View>
        </View>

        <Field label="DESCRIPTION (optional)">
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
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
