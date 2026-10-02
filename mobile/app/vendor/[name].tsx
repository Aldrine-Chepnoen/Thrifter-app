// Mobile port of frontend/src/components/VendorPage.jsx. Own-store view gets
// the same 3 tabs as web (My Items / Orders / Subscription); everyone else
// gets the item grid plus a share/report/block menu. The web verify-link
// confirmation flow (tapping an SMS link opens a `?verify=token` modal) isn't
// ported — that link already opens fine in a mobile browser since it's a
// plain web URL, independent of this app; only the "send verification SMS"
// trigger itself is replicated here.
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, ActivityIndicator,
  TouchableOpacity, Dimensions, TextInput, ScrollView,
  Modal, Linking, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import ItemCard, { type Item } from '@/components/ItemCard';
import ReportModal from '@/components/ReportModal';
import UpgradeToPremiumModal, { type SlotStatus } from '@/components/UpgradeToPremiumModal';
import { getImageSrc } from '@/lib/imageHost';
import api from '@/lib/api';

type VendorProfile = {
  id: number;
  name: string;
  item_count: number;
  banner_image?: string | null;
  banner_fallback_url?: string | null;
  description?: string | null;
  location?: string | null;
  is_premium?: boolean;
  hidden_item_count?: number | null;
  marketplace_visible?: boolean | null;
  phone_verified?: boolean | null;
};

type OrderItem = {
  id: number;
  item_name_snapshot: string;
  price_at_purchase: number;
  quantity: number;
  image_path?: string | null;
  fallback_url?: string | null;
  note?: string | null;
};

type VendorOrder = {
  id: number;
  checkout_id: number;
  subtotal: number;
  commission_amount: number;
  vendor_payout_amount: number;
  status: string;
  created_at: string;
  delivery_day: string;
  items: OrderItem[];
};

type Withdrawal = { id: number; amount: number; status: string; requested_at: string; failure_reason?: string | null };
type Wallet = { balance: number; currency: string; min_payout_amount: number; pending_withdrawal?: Withdrawal | null; in_progress_withdrawal?: Withdrawal | null };

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', paid: 'Order placed', picked_up: 'On delivery', delivered: 'Delivered', cancelled: 'Cancelled',
};

const formatUGX = (n: number) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
};
const formatDate = (d: string) => new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' });

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 12;
const GAP = 8;
const CARD_WIDTH = (SCREEN_WIDTH - H_PAD * 2 - GAP) / 2;
const BANNER_HEIGHT = 180;

export default function VendorScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { user, refreshUser } = useAuth();
  const { showToast, confirmToast } = useToast();
  const insets = useSafeAreaInsets();

  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  const [activeTab, setActiveTab] = useState<'items' | 'orders' | 'subscription'>('items');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [verifySmsSending, setVerifySmsSending] = useState(false);
  const [verifySmsSent, setVerifySmsSent] = useState(false);

  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const [subscriptionStatus, setSubscriptionStatus] = useState<SlotStatus | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const isOwnStore =
    !!user?.is_vendor &&
    !!user?.vendor_name &&
    user.vendor_name.toLowerCase() === name?.toLowerCase();

  const fetchData = useCallback(async () => {
    if (!name) return;
    try {
      const [profileRes, itemsRes] = await Promise.all([
        api.get<VendorProfile>(`/vendors/${encodeURIComponent(name)}`),
        api.get<Item[]>('/items', { params: { vendor: name, limit: 100 } }),
      ]);
      setVendor(profileRes.data);
      setItems(itemsRes.data);
    } catch (e: any) {
      if (e?.response?.status === 404) setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  // Buyer-view wardrobe hearts.
  useEffect(() => {
    if (!user || isOwnStore) return;
    api.get<Item[]>('/wardrobe').then(({ data }) => setSavedIds(new Set(data.map((i) => i.id)))).catch(() => {});
  }, [user, isOwnStore]);

  const handleAddToWardrobe = async (itemId: number, wasSaved: boolean) => {
    if (!user) { router.push('/auth/login'); throw new Error('not authed'); }
    if (wasSaved) {
      await api.delete(`/wardrobe/${itemId}`);
      setSavedIds((prev) => { const n = new Set(prev); n.delete(itemId); return n; });
    } else {
      await api.post(`/wardrobe/${itemId}`);
      setSavedIds((prev) => new Set(prev).add(itemId));
    }
  };

  useEffect(() => {
    if (!user || !vendor || isOwnStore) { setBlocked(false); return; }
    api.get<{ vendor_id: number }[]>('/me/blocked-vendors')
      .then(({ data }) => setBlocked(data.some((b) => b.vendor_id === vendor.id)))
      .catch(() => {});
  }, [user, vendor, isOwnStore]);

  const toggleBlock = async () => {
    if (!vendor) return;
    setBlockBusy(true);
    try {
      if (blocked) {
        await api.delete(`/vendors/${vendor.id}/block`);
        setBlocked(false);
      } else {
        await api.post(`/vendors/${vendor.id}/block`);
        setBlocked(true);
      }
    } catch {
      showToast('Could not update. Please try again.');
    } finally {
      setBlockBusy(false);
    }
  };

  // Orders + wallet — fetched once the Orders tab is actually opened.
  const loadOrders = useCallback(() => {
    setOrdersLoading(true);
    api.get<VendorOrder[]>('/vendor/orders').then(({ data }) => setOrders(data)).catch(() => {}).finally(() => setOrdersLoading(false));
    api.get<Wallet>('/vendor/me/wallet').then(({ data }) => setWallet(data)).catch(() => {});
  }, []);

  const loadSubscription = useCallback(() => {
    api.get<SlotStatus>('/vendor/me/subscription').then(({ data }) => setSubscriptionStatus(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isOwnStore) return;
    if (activeTab === 'orders' && orders.length === 0 && !ordersLoading) loadOrders();
    if (activeTab === 'subscription' && !subscriptionStatus) loadSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwnStore, activeTab]);

  const handleWithdraw = async () => {
    if (!wallet) return;
    const ok = await confirmToast(`Withdraw ${formatUGX(wallet.balance)}? An admin will review and send it to your phone number.`, 'Withdraw');
    if (!ok) return;
    setWithdrawing(true);
    try {
      const { data } = await api.post<Wallet>('/vendor/me/wallet/withdraw');
      setWallet(data);
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? 'Could not request withdrawal.');
    } finally {
      setWithdrawing(false);
    }
  };

  const openSettings = () => {
    setEditName(vendor?.name ?? name ?? '');
    setEditWhatsapp(user?.vendor_whatsapp ?? '');
    setEditDescription(vendor?.description ?? '');
    setEditLocation(vendor?.location ?? '');
    setVerifySmsSent(false);
    setSettingsOpen(true);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/vendor/me', {
        name: editName,
        whatsapp: editWhatsapp,
        description: editDescription || null,
        location: editLocation.trim() || null,
      });
      // AuthContext's user.vendor_name/vendor_whatsapp would otherwise stay
      // stale after this save — isOwnStore's comparison against the route's
      // `name` param depends on it, so without this a rename makes the
      // vendor's own store look like someone else's the moment the redirect
      // below lands (losing the management tabs, Edit page button, etc.)
      // until something else happens to refresh it.
      await refreshUser();
      setSettingsOpen(false);
      const newName = data.vendor_name as string;
      setVendor((prev) => prev ? {
        ...prev, name: newName, description: editDescription || null, location: editLocation.trim() || null,
      } : prev);
      if (newName.toLowerCase() !== (name ?? '').toLowerCase()) {
        router.replace(`/vendor/${encodeURIComponent(newName)}`);
      }
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleSendVerifySms = async () => {
    setVerifySmsSending(true);
    try {
      const { data } = await api.post('/vendor/me/verify-sms');
      if (data.status === 'already_verified') {
        setVendor((prev) => prev ? { ...prev, phone_verified: true } : prev);
      } else {
        setVerifySmsSent(true);
      }
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? 'Could not send verification SMS. Please try again.');
    } finally {
      setVerifySmsSending(false);
    }
  };

  const handleBannerUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    setBannerUploading(true);
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() ?? 'banner.jpg';
      const ext = filename.split('.').pop()?.toLowerCase();
      formData.append('file', { uri, name: filename, type: ext === 'png' ? 'image/png' : 'image/jpeg' } as any);
      const { data } = await api.post('/vendor/me/banner', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setVendor((prev) => prev ? { ...prev, banner_image: data.banner_image, banner_fallback_url: data.banner_fallback_url } : prev);
    } catch {
      showToast('Failed to upload banner image');
    } finally {
      setBannerUploading(false);
    }
  };

  const buildShareText = () => {
    const vendorDisplayName = vendor?.name ?? name;
    const itemCount = items.length;
    const lines = [`Get these items on Thrifter;`, `"${vendorDisplayName}"`];
    if (vendor?.description) lines.push(vendor.description);
    lines.push(`${itemCount} item${itemCount !== 1 ? 's' : ''} available`);
    lines.push(`https://thrifter-ug.com/vendor/${encodeURIComponent(vendorDisplayName ?? '')}`);
    return lines.join('\n');
  };

  const handleShareWhatsApp = () => {
    setMenuOpen(false);
    const text = buildShareText();
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`).catch(() =>
      showToast('Could not open WhatsApp.')
    );
  };

  const handleCopyLink = async () => {
    setMenuOpen(false);
    await Clipboard.setStringAsync(buildShareText());
    showToast('Link copied!', 'success');
  };

  const handleEdit = (itemId: number) => router.push(`/edit/${itemId}`);
  const handleDelete = async (itemId: number) => {
    const ok = await confirmToast('This will permanently remove the listing. This cannot be undone.', 'Delete');
    if (!ok) return;
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    try {
      await api.delete(`/items/${itemId}`);
    } catch {
      fetchData();
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator color="#EAAD11" size="large" />
      </View>
    );
  }

  if (notFound || !vendor) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900 px-8" style={{ paddingTop: insets.top }}>
        <Ionicons name="storefront-outline" size={52} color="#E5E7EB" />
        <Text className="text-gray-700 dark:text-gray-300 font-semibold mt-4">Store not found</Text>
        <TouchableOpacity className="mt-6" onPress={() => router.back()}>
          <Text className="text-[#EAAD11] font-semibold">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const bannerSrc = vendor.banner_image
    ? getImageSrc({ image_path: vendor.banner_image, fallback_url: vendor.banner_fallback_url }, 800)
    : null;

  const phoneChanged = editWhatsapp.trim() !== (user?.vendor_whatsapp ?? '').trim();

  const SettingsPanel = (
    <View className="px-4 py-5 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
      <Text className="text-base font-serif-bold text-gray-900 dark:text-white mb-4">Store Settings</Text>
      <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">STORE NAME *</Text>
      <TextInput
        className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-4 py-3 text-gray-900 text-base mb-3"
        value={editName}
        onChangeText={setEditName}
      />
      <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">PHONE NUMBER *</Text>
      <TextInput
        className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-4 py-3 text-gray-900 text-base"
        value={editWhatsapp}
        onChangeText={setEditWhatsapp}
        placeholder="+256..."
        placeholderTextColor="#9CA3AF"
        keyboardType="phone-pad"
      />
      {vendor.phone_verified ? (
        <View className="flex-row items-center gap-1 mt-1.5">
          <Ionicons name="shield-checkmark" size={14} color="#16A34A" />
          <Text className="text-xs font-medium text-green-600 dark:text-green-400">Verified</Text>
        </View>
      ) : phoneChanged ? (
        <Text className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">Save changes first, then send the verification link.</Text>
      ) : verifySmsSent ? (
        <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">Verification link sent — check your SMS.</Text>
      ) : (
        <TouchableOpacity
          onPress={handleSendVerifySms}
          disabled={verifySmsSending || !editWhatsapp.trim()}
          className="flex-row items-center gap-1.5 mt-1.5"
        >
          <Ionicons name="shield-checkmark-outline" size={16} color="#EAAD11" />
          <Text className="text-sm font-bold text-[#EAAD11]">{verifySmsSending ? 'Sending…' : 'Send verification SMS'}</Text>
        </TouchableOpacity>
      )}
      <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 mt-3">BIO (optional)</Text>
      <TextInput
        className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-4 py-3 text-gray-900 text-base mb-3"
        value={editDescription}
        onChangeText={setEditDescription}
        placeholder="Tell shoppers about your store..."
        placeholderTextColor="#9CA3AF"
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        style={{ minHeight: 70 }}
      />
      <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">PICKUP LOCATION *</Text>
      <TextInput
        className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-4 py-3 text-gray-900 text-base mb-4"
        value={editLocation}
        onChangeText={setEditLocation}
        placeholder="e.g. Kampala, Uganda"
        placeholderTextColor="#9CA3AF"
      />
      <View className="flex-row gap-3">
        <TouchableOpacity
          onPress={handleSaveSettings}
          disabled={saving || !editName.trim() || !editWhatsapp.trim()}
          className="bg-[#EAAD11] rounded-xl px-5 py-3 flex-1 items-center"
          style={{ opacity: saving ? 0.6 : 1 }}
        >
          {saving ? <ActivityIndicator color="#000" size="small" /> : <Text className="text-black font-bold text-sm">Save Changes</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSettingsOpen(false)}
          className="border border-gray-200 dark:border-gray-700 rounded-xl px-5 py-3 flex-1 items-center"
        >
          <Text className="text-gray-600 dark:text-gray-300 font-semibold text-sm">Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const OrdersTab = (
    <View className="px-4 pt-4">
      {wallet && (
        <View className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 mb-4">
          <View className="flex-row items-center gap-3 mb-1">
            <View className="w-9 h-9 rounded-full bg-[#EAAD11]/15 items-center justify-center">
              <Ionicons name="wallet-outline" size={18} color="#EAAD11" />
            </View>
            <View>
              <Text className="text-xs text-gray-500 dark:text-gray-400">Wallet balance</Text>
              <Text className="text-lg font-bold text-gray-900 dark:text-white">{formatUGX(wallet.balance)}</Text>
            </View>
          </View>
          {wallet.pending_withdrawal ? (
            <Text className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-2">
              {formatUGX(wallet.pending_withdrawal.amount)} pending admin approval
            </Text>
          ) : wallet.in_progress_withdrawal ? (
            <Text className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-2">
              {formatUGX(wallet.in_progress_withdrawal.amount)} withdrawal in progress
            </Text>
          ) : (
            <TouchableOpacity
              onPress={handleWithdraw}
              disabled={withdrawing || wallet.balance <= 0 || (wallet.balance > 0 && wallet.balance < wallet.min_payout_amount)}
              className="bg-[#EAAD11] rounded-lg px-4 py-2 self-start mt-2"
              style={{ opacity: wallet.balance <= 0 ? 0.5 : 1 }}
            >
              <Text className="text-black font-bold text-xs">{withdrawing ? 'Requesting…' : 'Withdraw'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {ordersLoading ? (
        <ActivityIndicator color="#EAAD11" style={{ marginTop: 24 }} />
      ) : orders.length === 0 ? (
        <Text className="text-center text-gray-400 dark:text-gray-500 text-sm py-10">No orders yet.</Text>
      ) : (
        orders.flatMap((order) => order.items.map((oi) => (
          <View key={oi.id} className="flex-row items-center gap-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 mb-2">
            <Image
              source={{ uri: getImageSrc({ image_path: oi.image_path, fallback_url: oi.fallback_url }, 100) ?? '' }}
              style={{ width: 44, height: 52, borderRadius: 8 }}
              contentFit="cover"
            />
            <View className="flex-1">
              <Text className="font-medium text-gray-900 dark:text-gray-100" numberOfLines={1}>{oi.item_name_snapshot}</Text>
              <Text className="text-xs text-gray-400 dark:text-gray-500">
                Order #{order.id} · {formatUGX(oi.price_at_purchase)}{oi.quantity > 1 ? ` × ${oi.quantity}` : ''}
              </Text>
              <Text className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                Pickup {formatDate(order.delivery_day)} · {ORDER_STATUS_LABELS[order.status] ?? order.status}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatUGX(order.vendor_payout_amount)}</Text>
              <Text className="text-[10px] text-gray-400 dark:text-gray-500">after fees</Text>
            </View>
          </View>
        )))
      )}
    </View>
  );

  const SubscriptionTab = (
    <View className="px-4 pt-4">
      {!subscriptionStatus ? (
        <ActivityIndicator color="#EAAD11" style={{ marginTop: 24 }} />
      ) : (
        <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5">
          <View className="flex-row items-center gap-2 mb-1">
            {subscriptionStatus.is_premium && <MaterialCommunityIcons name="crown" size={16} color="#EAAD11" />}
            <Text className="font-bold text-gray-900 dark:text-white">{subscriptionStatus.is_premium ? 'Premium plan' : 'Free plan'}</Text>
          </View>
          {subscriptionStatus.is_premium && subscriptionStatus.expires_at && (
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Renews/expires {new Date(subscriptionStatus.expires_at).toLocaleDateString()}
            </Text>
          )}
          <View className="flex-row justify-between mt-2">
            <Text className="text-sm text-gray-500 dark:text-gray-400">Active listings</Text>
            <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {subscriptionStatus.active_item_count}{subscriptionStatus.is_premium ? '' : ` / ${subscriptionStatus.free_item_limit}`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowUpgradeModal(true)}
            className={`rounded-xl py-3.5 items-center mt-4 ${subscriptionStatus.is_premium ? 'bg-gray-200 dark:bg-gray-700' : 'bg-[#EAAD11]'}`}
          >
            <Text className={`font-bold text-sm ${subscriptionStatus.is_premium ? 'text-gray-900 dark:text-gray-100' : 'text-black'}`}>
              {subscriptionStatus.is_premium ? `Pay for another month — ${formatUGX(subscriptionStatus.price_ugx)}` : `Upgrade to Premium — ${formatUGX(subscriptionStatus.price_ugx)}/30 days`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const ListHeader = (
    <View>
      {bannerSrc ? (
        <Image source={{ uri: bannerSrc }} style={{ width: SCREEN_WIDTH, height: BANNER_HEIGHT }} contentFit="cover" />
      ) : (
        <View style={{ width: SCREEN_WIDTH, height: BANNER_HEIGHT }} className="bg-gray-100 dark:bg-gray-800 items-center justify-center">
          <Ionicons name="camera-outline" size={40} color="#9CA3AF" />
        </View>
      )}
      {isOwnStore && (
        <TouchableOpacity
          onPress={handleBannerUpload}
          disabled={bannerUploading}
          className="absolute bottom-3 right-3 bg-black/50 rounded-full w-10 h-10 items-center justify-center"
        >
          {bannerUploading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="camera" size={18} color="#fff" />}
        </TouchableOpacity>
      )}

      <View className="px-4 py-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <View className="flex-row items-center gap-2 flex-wrap">
              <Text className="text-2xl font-bold text-gray-900 dark:text-white">{vendor.name}</Text>
              {vendor.is_premium && (
                <View className="flex-row items-center gap-1 bg-[#EAAD11] px-2 py-1 rounded-full">
                  <MaterialCommunityIcons name="crown" size={12} color="#000" />
                  <Text className="text-[11px] font-bold text-black">Premium</Text>
                </View>
              )}
            </View>
            {vendor.description ? (
              <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{vendor.description}</Text>
            ) : (
              <Text className="text-xs text-gray-400 dark:text-gray-500 mt-1">{items.length} items</Text>
            )}
          </View>
          {isOwnStore && (
            <TouchableOpacity
              onPress={() => (settingsOpen ? setSettingsOpen(false) : openSettings())}
              className="bg-[#EAAD11] rounded-full px-4 py-2"
            >
              <Text className="text-black font-bold text-xs">{settingsOpen ? 'Close' : 'Edit page'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isOwnStore && settingsOpen && SettingsPanel}

      {/* Gold action bar */}
      <View className="bg-[#EAAD11] px-4 py-3 flex-row items-center justify-between">
        {isOwnStore ? (
          <TouchableOpacity onPress={() => router.push('/upload')} className="flex-row items-center gap-1.5 bg-white rounded-full px-4 py-2">
            <Ionicons name="add" size={16} color="#000" />
            <Text className="text-black font-bold text-xs">sell a piece</Text>
          </TouchableOpacity>
        ) : <View />}
        <TouchableOpacity
          onPress={() => setMenuOpen(true)}
          className="bg-black/80 rounded-full w-10 h-10 items-center justify-center"
        >
          <Ionicons name="share-social-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {!isOwnStore && blocked && (
        <View className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800 flex-row items-center justify-between gap-3">
          <Text className="text-sm text-gray-600 dark:text-gray-300 flex-1">You&apos;ve blocked this vendor — their items won&apos;t show in your feed.</Text>
          <TouchableOpacity onPress={toggleBlock} disabled={blockBusy}>
            <Text className="text-sm font-bold text-[#EAAD11]">Unblock</Text>
          </TouchableOpacity>
        </View>
      )}

      {isOwnStore && (
        <View className="flex-row border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          {([{ key: 'items', label: 'My Items' }, { key: 'orders', label: 'Orders' }, { key: 'subscription', label: 'Subscription' }] as const).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className="px-4 py-3"
              style={{ borderBottomWidth: 2, borderBottomColor: activeTab === tab.key ? '#EAAD11' : 'transparent' }}
            >
              <Text className={`text-sm font-semibold ${activeTab === tab.key ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isOwnStore && activeTab === 'orders' && OrdersTab}
      {isOwnStore && activeTab === 'subscription' && SubscriptionTab}

      {(!isOwnStore || activeTab === 'items') && <View style={{ height: H_PAD }} />}
    </View>
  );

  const showGrid = !isOwnStore || activeTab === 'items';

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-950">
      <TouchableOpacity
        onPress={() => router.back()}
        className="absolute z-10 bg-white/90 rounded-full w-9 h-9 items-center justify-center"
        style={{ top: insets.top + 8, left: 16 }}
      >
        <Ionicons name="chevron-back" size={20} color="#111" />
      </TouchableOpacity>

      <FlatList
        data={showGrid ? items : []}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: H_PAD, paddingBottom: 32 }}
        columnWrapperStyle={showGrid ? { gap: GAP } : undefined}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            cardWidth={CARD_WIDTH}
            onPress={(i) => router.push(`/item/${i.id}`)}
            onEdit={isOwnStore ? handleEdit : undefined}
            onRemove={isOwnStore ? handleDelete : undefined}
            onAddToWardrobe={!isOwnStore ? handleAddToWardrobe : undefined}
            savedIds={savedIds}
          />
        )}
        ListEmptyComponent={
          showGrid ? (
            <View className="items-center py-16">
              <Ionicons name="shirt-outline" size={48} color="#E5E7EB" />
              <Text className="text-gray-400 dark:text-gray-500 mt-3 text-sm">
                {isOwnStore ? 'No listings yet — add your first item.' : 'No items listed yet.'}
              </Text>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Share / report / block menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity className="flex-1 bg-black/40 justify-end" activeOpacity={1} onPress={() => setMenuOpen(false)}>
          <TouchableOpacity activeOpacity={1} className="bg-white dark:bg-gray-800 rounded-t-3xl overflow-hidden">
            <View className="w-12 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full self-center my-3" />
            <TouchableOpacity onPress={handleShareWhatsApp} className="flex-row items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-200">Share on WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCopyLink} className="flex-row items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <Ionicons name="copy-outline" size={18} color="#9CA3AF" />
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-200">Copy link</Text>
            </TouchableOpacity>
            {!isOwnStore && user && (
              <>
                <TouchableOpacity
                  onPress={() => { setMenuOpen(false); setReportOpen(true); }}
                  className="flex-row items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700"
                >
                  <Ionicons name="flag-outline" size={18} color="#9CA3AF" />
                  <Text className="text-sm font-medium text-gray-700 dark:text-gray-200">Report vendor</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setMenuOpen(false); toggleBlock(); }}
                  disabled={blockBusy}
                  className="flex-row items-center gap-3 px-5 py-4"
                >
                  <Ionicons name="ban-outline" size={18} color="#9CA3AF" />
                  <Text className="text-sm font-medium text-gray-700 dark:text-gray-200">{blocked ? 'Unblock vendor' : 'Block vendor'}</Text>
                </TouchableOpacity>
              </>
            )}
            <View style={{ height: insets.bottom + 8 }} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {vendor && (
        <ReportModal visible={reportOpen} onClose={() => setReportOpen(false)} targetType="vendor" targetId={vendor.id} />
      )}

      {isOwnStore && (
        <UpgradeToPremiumModal visible={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} onUpgraded={loadSubscription} />
      )}
    </View>
  );
}
