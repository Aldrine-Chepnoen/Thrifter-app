import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import UpgradeToPremiumModal, { type SlotStatus } from '@/components/UpgradeToPremiumModal';

const ITEM_TYPES = [
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'dress', label: 'Dress / Jumpsuit' },
  { value: 'accessory', label: 'Accessory' },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">{label}</Text>
      {children}
    </View>
  );
}

export default function UploadScreen() {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [images, setImages] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [itemType, setItemType] = useState('top');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [authChecked, setAuthChecked] = useState(false);
  const [canUpload, setCanUpload] = useState(true);
  const [slotBlocked, setSlotBlocked] = useState(false);
  const [slotCheckFailed, setSlotCheckFailed] = useState(false);
  const [checkingSlot, setCheckingSlot] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  // Fail closed: until we've positively confirmed the vendor has room, the
  // form stays disabled — covers the initial load, a slow/failed slot check,
  // and the confirmed-over-limit case with the same guard.
  const formDisabled = !authChecked || !canUpload || slotBlocked || slotCheckFailed;

  // autoPromptUpgrade is false when this is a background refresh after the
  // vendor just initiated a payment (UpgradeToPremiumModal's onUpgraded) —
  // the payment is still pending at that point, so a plain re-check would
  // still see them as over-limit and snap the modal they just closed right
  // back open. Only the initial mount check and the manual "Retry" link
  // should be allowed to auto-open it.
  const checkSlotStatus = async (autoPromptUpgrade = true) => {
    setCheckingSlot(true);
    setSlotCheckFailed(false);
    try {
      const { data } = await api.get<SlotStatus>('/vendor/me/subscription');
      if (!data.is_premium && data.active_item_count >= data.free_item_limit) {
        setSlotBlocked(true);
        if (autoPromptUpgrade) setShowUpgradeModal(true);
      } else {
        setSlotBlocked(false);
      }
    } catch {
      setSlotCheckFailed(true);
    } finally {
      setCheckingSlot(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/auth/me');
        const isVendor = !!data?.is_vendor;
        setCanUpload(isVendor);
        if (isVendor) await checkSlotStatus();
      } catch {
        setCanUpload(false);
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

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
    if (formDisabled) {
      if (slotBlocked) setShowUpgradeModal(true);
      else if (!canUpload) showToast('Login with a business account to list items.', 'error');
      else if (slotCheckFailed) showToast("We couldn't confirm your account status. Please retry before listing an item.", 'error');
      return;
    }
    if (images.length === 0) { showToast('Add at least one photo.', 'error'); return; }
    if (!name.trim()) { showToast('Item name is required.', 'error'); return; }
    const priceNum = Number(price);
    if (!price.trim() || isNaN(priceNum) || priceNum < 1000) { showToast('Minimum item price is UGX 1,000.', 'error'); return; }
    if (!size.trim()) { showToast('Size is required.', 'error'); return; }
    if (!quantity.trim() || isNaN(Number(quantity)) || Number(quantity) < 0) { showToast('Enter a valid quantity.', 'error'); return; }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('price', price.trim());
      formData.append('size', size.trim());
      formData.append('item_type', itemType);
      formData.append('quantity', quantity.trim());
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

      showToast('Your item is now live.', 'success');
      router.back();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.code === 'slot_limit_reached') {
        setSlotBlocked(true);
        setShowUpgradeModal(true);
      } else {
        const msg = typeof detail === 'string' ? detail : 'Upload failed. Try again.';
        showToast(msg, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-gray-900"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <TouchableOpacity onPress={() => router.back()} className="p-1 mr-3">
          <Ionicons name="close" size={22} color="#111" />
        </TouchableOpacity>
        <Text className="text-lg font-serif-bold text-gray-900 dark:text-white flex-1">New Listing</Text>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          className="bg-black rounded-xl px-4 py-2"
          style={{ opacity: submitting ? 0.6 : 1 }}
        >
          {submitting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text className="text-white font-bold">List Item</Text>}
        </TouchableOpacity>
      </View>

      {!authChecked ? (
        <Text className="text-sm text-gray-500 dark:text-gray-400 px-4 pt-3">Checking account...</Text>
      ) : !canUpload ? (
        <Text className="text-sm text-red-600 px-4 pt-3">You need a business account to list items.</Text>
      ) : slotCheckFailed ? (
        <View className="flex-row items-center gap-3 px-4 pt-3">
          <Text className="text-sm text-red-600 flex-1">We couldn't confirm your account status, so listing is paused.</Text>
          <TouchableOpacity onPress={() => checkSlotStatus()} disabled={checkingSlot}>
            <Text className="text-sm font-semibold text-[#EAAD11]">{checkingSlot ? 'Retrying…' : 'Retry'}</Text>
          </TouchableOpacity>
        </View>
      ) : slotBlocked ? (
        <View className="flex-row items-center gap-3 px-4 pt-3">
          <Text className="text-sm text-red-600 flex-1">You've reached your free plan's item limit.</Text>
          <TouchableOpacity onPress={() => setShowUpgradeModal(true)}>
            <Text className="text-sm font-semibold text-[#EAAD11]">Upgrade to Premium</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        {/* Image picker */}
        <Field label="PHOTOS (up to 3) *">
          <View className="flex-row gap-3 flex-wrap">
            {images.map((uri, i) => (
              <View key={i} style={{ position: 'relative', width: 90, aspectRatio: 4 / 5 }}>
                <Image
                  source={{ uri }}
                  style={{ width: '100%', height: '100%', borderRadius: 12 }}
                  contentFit="cover"
                />
                <TouchableOpacity
                  onPress={() => removeImage(i)}
                  style={{ position: 'absolute', top: -6, right: -6 }}
                  className="bg-gray-800 rounded-full w-5 h-5 items-center justify-center"
                >
                  <Ionicons name="close" size={10} color="#fff" />
                </TouchableOpacity>
                {i === 0 && (
                  <View className="absolute bottom-1.5 left-1.5 bg-black/60 rounded-full px-2 py-0.5">
                    <Text className="text-white text-[9px] font-medium">Primary</Text>
                  </View>
                )}
              </View>
            ))}
            {images.length < 3 && (
              <TouchableOpacity
                onPress={pickImages}
                disabled={formDisabled}
                style={{ width: 90, aspectRatio: 4 / 5, opacity: formDisabled ? 0.5 : 1 }}
                className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 items-center justify-center"
              >
                <Ionicons name="camera-outline" size={24} color="#9CA3AF" />
                <Text className="text-xs text-gray-400 dark:text-gray-500 mt-1">Add photo</Text>
              </TouchableOpacity>
            )}
          </View>
        </Field>

        {/* Name */}
        <Field label="ITEM NAME *">
          <TextInput
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 text-base"
            placeholder="e.g. Floral Summer Dress"
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
            maxLength={120}
            editable={!formDisabled}
          />
        </Field>

        {/* Price */}
        <Field label="PRICE (UGX) *">
          <TextInput
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 text-base"
            placeholder="e.g. 25000"
            placeholderTextColor="#9CA3AF"
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            editable={!formDisabled}
          />
        </Field>

        {/* Size + Quantity */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1">
            <Text className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">SIZE *</Text>
            <TextInput
              className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 text-base"
              placeholder="e.g. M, 42, UK8"
              placeholderTextColor="#9CA3AF"
              value={size}
              onChangeText={setSize}
              maxLength={20}
              editable={!formDisabled}
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">QUANTITY *</Text>
            <TextInput
              className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 text-base"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              editable={!formDisabled}
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
                disabled={formDisabled}
                className={`px-4 py-2 rounded-xl border ${
                  itemType === value
                    ? 'bg-[#EAAD11] border-[#EAAD11]'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}
                style={{ opacity: formDisabled ? 0.5 : 1 }}
              >
                <Text className={`text-sm font-medium ${itemType === value ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        {/* Description */}
        <Field label="DESCRIPTION (optional)">
          <TextInput
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 text-base"
            placeholder="Condition, style notes, etc."
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
            maxLength={500}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={{ minHeight: 80 }}
            editable={!formDisabled}
          />
        </Field>

        <View className="pb-10" />
      </ScrollView>

      <UpgradeToPremiumModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgraded={() => checkSlotStatus(false)}
      />
    </KeyboardAvoidingView>
  );
}
