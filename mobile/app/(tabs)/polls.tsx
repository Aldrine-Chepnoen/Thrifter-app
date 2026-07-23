import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, RefreshControl, ActivityIndicator,
  TouchableOpacity, Modal, TextInput, Alert, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

type DemandEntry = {
  id: number;
  item_name: string;
  price: string;
  description?: string | null;
  upvotes: number;
  downvotes: number;
  score: number;
  user_vote?: 'up' | 'down' | null;
};

// ── Entry card ───────────────────────────────────────────────────────────────
function EntryCard({
  entry, rank, onVote,
}: {
  entry: DemandEntry;
  rank: number;
  onVote: (id: number, type: 'up' | 'down') => void;
}) {
  return (
    <View
      className="bg-white rounded-2xl px-4 py-4 mb-3"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 }}
    >
      {/* Rank + name */}
      <View className="flex-row items-start gap-2 mb-1">
        <Text style={{ minWidth: 32 }} className="text-base font-bold text-gray-300">#{rank}</Text>
        <Text className="flex-1 text-base font-semibold text-gray-900 leading-tight" numberOfLines={2}>
          {entry.item_name}
        </Text>
      </View>

      {/* Price */}
      <Text className="text-sm text-[#EAAD11] font-medium mb-1" style={{ marginLeft: 32 }}>
        {entry.price}
      </Text>

      {/* Description */}
      {entry.description ? (
        <Text className="text-xs text-gray-400 mb-2" style={{ marginLeft: 32 }} numberOfLines={2}>
          {entry.description}
        </Text>
      ) : null}

      {/* Vote buttons — horizontal, right-aligned */}
      <View className="flex-row justify-end gap-2 mt-1">
        <TouchableOpacity
          onPress={() => onVote(entry.id, 'up')}
          className={`flex-row items-center gap-1.5 px-3 py-2 rounded-xl ${entry.user_vote === 'up' ? 'bg-green-50' : 'bg-gray-50'}`}
        >
          <Text className={`text-sm font-bold ${entry.user_vote === 'up' ? 'text-green-500' : 'text-gray-400'}`}>▲</Text>
          <Text className={`text-sm font-semibold ${entry.user_vote === 'up' ? 'text-green-500' : 'text-gray-400'}`}>
            {entry.upvotes}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onVote(entry.id, 'down')}
          className={`flex-row items-center gap-1.5 px-3 py-2 rounded-xl ${entry.user_vote === 'down' ? 'bg-red-50' : 'bg-gray-50'}`}
        >
          <Text className={`text-sm font-bold ${entry.user_vote === 'down' ? 'text-red-400' : 'text-gray-300'}`}>▼</Text>
          <Text className={`text-sm font-semibold ${entry.user_vote === 'down' ? 'text-red-400' : 'text-gray-300'}`}>
            {entry.downvotes}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function PollsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [entries, setEntries] = useState<DemandEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [votingIds, setVotingIds] = useState<Set<number>>(new Set());

  // Info modal
  const [infoOpen, setInfoOpen] = useState(false);

  // Submit modal
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchEntries = useCallback(async () => {
    try {
      const { data } = await api.get<DemandEntry[]>('/demand');
      setEntries(data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetchEntries(); }, [fetchEntries]));

  const onRefresh = () => { setRefreshing(true); fetchEntries(); };

  // ── Vote ───────────────────────────────────────────────────────────────────
  const handleVote = async (entryId: number, voteType: 'up' | 'down') => {
    if (!user) { router.push('/auth/login'); return; }
    if (votingIds.has(entryId)) return;

    // Optimistic update + re-sort
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== entryId) return e;
        let { upvotes, downvotes, user_vote } = e;
        if (user_vote === voteType) {
          if (voteType === 'up') upvotes--; else downvotes--;
          user_vote = null;
        } else {
          if (user_vote === 'up') upvotes--;
          if (user_vote === 'down') downvotes--;
          if (voteType === 'up') upvotes++; else downvotes++;
          user_vote = voteType;
        }
        return { ...e, upvotes, downvotes, score: upvotes - downvotes, user_vote };
      }).sort((a, b) => b.score - a.score)
    );

    setVotingIds((s) => new Set(s).add(entryId));
    try {
      await api.post(`/demand/${entryId}/vote`, { vote_type: voteType });
    } catch {
      fetchEntries(); // revert on error
    } finally {
      setVotingIds((s) => { const n = new Set(s); n.delete(entryId); return n; });
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const openSubmit = () => {
    if (!user) { router.push('/auth/login'); return; }
    setSubmitOpen(true);
  };

  const closeSubmit = () => {
    setSubmitOpen(false);
    setSubmitted(false);
    setItemName(''); setPrice(''); setDescription('');
  };

  const handleSubmit = async () => {
    if (!itemName.trim() || !price.trim()) {
      Alert.alert('Required', 'Item name and price are required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/demand', {
        item_name: itemName.trim(),
        price: price.trim(),
        description: description.trim() || undefined,
      });
      setSubmitted(true);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail ?? 'Could not submit. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#EAAD11" size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white border-b border-gray-100 px-4 py-3 flex-row items-center">
        <Text className="text-2xl font-bold text-gray-900 flex-1">Demand Board</Text>
        <TouchableOpacity onPress={() => setInfoOpen(true)} className="p-2">
          <Ionicons name="information-circle-outline" size={22} color="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onRefresh} className="p-2">
          <Ionicons name="refresh" size={20} color="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={openSubmit}
          className="ml-1 bg-[#EAAD11] rounded-xl px-3 py-2"
        >
          <Text className="text-white font-bold text-sm">+ Request</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(e) => e.id.toString()}
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#EAAD11" />}
        renderItem={({ item, index }) => (
          <EntryCard entry={item} rank={index + 1} onVote={handleVote} />
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-24">
            <Ionicons name="stats-chart-outline" size={52} color="#E5E7EB" />
            <Text className="text-gray-700 font-semibold mt-4">No requests yet</Text>
            <Text className="text-gray-400 text-sm mt-1 text-center px-8">
              Be the first to request something from vendors
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* ── Info modal ─────────────────────────────────────────────────────── */}
      <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
        <TouchableOpacity
          className="flex-1 bg-black/40 justify-center px-6"
          activeOpacity={1}
          onPress={() => setInfoOpen(false)}
        >
          <TouchableOpacity activeOpacity={1}>
            <View className="bg-white rounded-2xl p-6">
              <Text className="text-xl font-bold text-gray-900 mb-4">About the Demand Board</Text>

              <Text className="text-sm font-semibold text-gray-700 mb-1">What is this?</Text>
              <Text className="text-sm text-gray-500 mb-4">
                A place for shoppers to request clothing items they want to see stocked. Vendors use it to know what people are looking for.
              </Text>

              <Text className="text-sm font-semibold text-gray-700 mb-1">What does voting do?</Text>
              <Text className="text-sm text-gray-500 mb-4">
                Upvoting shows vendors this item is in demand. Downvoting pushes it down the list. The most wanted items rank highest.
              </Text>

              <Text className="text-sm font-semibold text-gray-700 mb-1">After submitting?</Text>
              <Text className="text-sm text-gray-500 mb-5">
                Your request goes to our team for approval before appearing on the board.
              </Text>

              <TouchableOpacity
                className="bg-gray-100 rounded-xl py-3 items-center"
                onPress={() => setInfoOpen(false)}
              >
                <Text className="text-gray-700 font-semibold">Got it</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Submit modal ───────────────────────────────────────────────────── */}
      <Modal visible={submitOpen} transparent animationType="slide" onRequestClose={closeSubmit}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={closeSubmit} />
          <View className="bg-white rounded-t-3xl px-6 pt-5 pb-8">
            {submitted ? (
              <View className="items-center py-6">
                <Ionicons name="checkmark-circle" size={52} color="#EAAD11" />
                <Text className="text-xl font-bold text-gray-900 mt-3">Request submitted</Text>
                <Text className="text-gray-400 text-sm text-center mt-2">
                  Your request is pending approval and will appear on the board once reviewed.
                </Text>
                <TouchableOpacity
                  className="bg-gray-100 rounded-xl py-3 px-8 mt-6"
                  onPress={closeSubmit}
                >
                  <Text className="text-gray-700 font-semibold">Close</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View className="flex-row items-center mb-5">
                  <Text className="text-xl font-bold text-gray-900 flex-1">New Request</Text>
                  <TouchableOpacity onPress={closeSubmit}>
                    <Ionicons name="close" size={22} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                <Text className="text-xs text-gray-500 mb-1 font-medium">ITEM NAME *</Text>
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 mb-4 text-gray-900 text-base"
                  placeholder="e.g. Floral summer dress"
                  placeholderTextColor="#9CA3AF"
                  value={itemName}
                  onChangeText={setItemName}
                  maxLength={100}
                />

                <Text className="text-xs text-gray-500 mb-1 font-medium">PRICE RANGE *</Text>
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 mb-4 text-gray-900 text-base"
                  placeholder="e.g. UGX 20,000 – 40,000"
                  placeholderTextColor="#9CA3AF"
                  value={price}
                  onChangeText={setPrice}
                  maxLength={100}
                />

                <Text className="text-xs text-gray-500 mb-1 font-medium">DESCRIPTION <Text className="text-gray-400 font-normal">(optional)</Text></Text>
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 mb-6 text-gray-900 text-base"
                  placeholder="e.g. Size M, navy blue, for church"
                  placeholderTextColor="#9CA3AF"
                  value={description}
                  onChangeText={setDescription}
                  maxLength={300}
                  multiline
                  numberOfLines={2}
                />

                <TouchableOpacity
                  className="bg-[#EAAD11] rounded-xl py-4 items-center"
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting
                    ? <ActivityIndicator color="#fff" />
                    : <Text className="text-white font-bold text-base">Submit Request</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
