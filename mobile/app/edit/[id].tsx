import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { type Item } from '@/components/ItemCard';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-1">{label}</Text>
      {children}
    </View>
  );
}

export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState('');
  const [description, setDescription] = useState('');
  // The update endpoint takes quantity as a delta from whatever the row's
  // live value is at save time (it re-diffs against a locked row, not this
  // snapshot) — so the original value just needs to be remembered to compute
  // that delta, not sent anywhere itself.
  const originalQuantity = useRef(0);

  useEffect(() => {
    api.get<Item>(`/items/${id}`)
      .then(({ data }) => {
        setName(data.name);
        setPrice(String(data.price));
        setSize(data.size ?? '');
        setQuantity(String(data.quantity ?? 1));
        originalQuantity.current = data.quantity ?? 1;
        setDescription(data.description ?? '');
      })
      .catch(() => showToast('Could not load item.', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!name.trim()) { showToast('Item name is required.', 'error'); return; }
    if (!price.trim() || isNaN(Number(price))) { showToast('Enter a valid price.', 'error'); return; }
    if (!size.trim()) { showToast('Size is required.', 'error'); return; }
    if (!quantity.trim() || isNaN(Number(quantity)) || Number(quantity) < 0) {
      showToast('Enter a valid quantity.', 'error'); return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('price', price.trim());
      formData.append('size', size.trim());
      const delta = Number(quantity) - originalQuantity.current;
      if (delta !== 0) formData.append('quantity_delta', String(delta));
      if (description.trim()) formData.append('description', description.trim());

      await api.put(`/items/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showToast('Changes saved.', 'success');
      router.back();
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? 'Could not save changes.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator color="#EAAD11" size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-gray-900"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <TouchableOpacity onPress={() => router.back()} className="p-1 mr-3">
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900 dark:text-white flex-1">Edit Listing</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={submitting}
          className="bg-[#25D366] rounded-xl px-4 py-2"
        >
          {submitting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text className="text-white font-bold">Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        <Field label="ITEM NAME *">
          <TextInput
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 text-base"
            value={name}
            onChangeText={setName}
            maxLength={120}
          />
        </Field>

        <Field label="PRICE (UGX) *">
          <TextInput
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 text-base"
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
          />
        </Field>

        <View className="flex-row gap-3 mb-4">
          <View className="flex-1">
            <Text className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-1">SIZE *</Text>
            <TextInput
              className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 text-base"
              value={size}
              onChangeText={setSize}
              maxLength={20}
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-1">QUANTITY *</Text>
            <TextInput
              className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 text-base"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
            />
          </View>
        </View>

        <Field label="DESCRIPTION (optional)">
          <TextInput
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 text-base"
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
