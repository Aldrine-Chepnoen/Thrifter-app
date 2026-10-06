import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '@/lib/api';

// Reasons mirror the Terms' own categories (clause 6.10 Prohibited Items,
// clause 11 Acceptable Use) rather than free text, so reports stay
// triageable — see backend/schemas.py REPORT_REASONS, which this must match.
const REASONS: { key: string; label: string }[] = [
  { key: 'counterfeit', label: 'Counterfeit or fake item' },
  { key: 'prohibited_item', label: 'Prohibited item' },
  { key: 'misleading', label: 'Misleading listing' },
  { key: 'harassment', label: 'Harassment or abuse' },
  { key: 'other', label: 'Something else' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  targetType: 'item' | 'vendor';
  targetId: number;
};

export default function ReportModal({ visible, onClose, targetType, targetId }: Props) {
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setReason(null);
    setNote('');
    setDone(false);
    setError(null);
  };
  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!reason) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/reports', {
        target_type: targetType,
        target_id: targetId,
        reason,
        note: note.trim() || undefined,
      });
      setDone(true);
    } catch {
      setError('Could not send your report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-white dark:bg-gray-900 rounded-t-3xl px-5 pt-5 pb-8">
          {done ? (
            <View className="items-center py-6">
              <Ionicons name="checkmark-circle" size={40} color="#22C55E" />
              <Text className="text-base font-semibold text-gray-900 dark:text-white mt-3">Report sent</Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1 text-center">Thanks &mdash; we&apos;ll take a look.</Text>
              <TouchableOpacity onPress={handleClose} className="mt-5 px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-800">
                <Text className="font-semibold text-gray-700 dark:text-gray-300">Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                Report this {targetType === 'item' ? 'item' : 'vendor'}
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400 mb-4">What&apos;s the issue?</Text>

              {REASONS.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  onPress={() => setReason(r.key)}
                  className={`flex-row items-center justify-between py-3 px-4 rounded-xl mb-2 border ${
                    reason === r.key ? 'border-[#EAAD11] bg-[#EAAD11]/10' : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                  }`}
                >
                  <Text className={`text-sm ${reason === r.key ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-700 dark:text-gray-300'}`}>
                    {r.label}
                  </Text>
                  {reason === r.key ? <Ionicons name="checkmark" size={18} color="#EAAD11" /> : null}
                </TouchableOpacity>
              ))}

              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Add details (optional)"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                className="border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 mt-1 mb-1"
                style={{ minHeight: 70, textAlignVertical: 'top' }}
              />
              {error ? <Text className="text-xs text-red-500 mb-2">{error}</Text> : null}

              <View className="flex-row gap-3 mt-3">
                <TouchableOpacity onPress={handleClose} className="flex-1 py-3.5 rounded-xl bg-gray-100 dark:bg-gray-800 items-center">
                  <Text className="font-semibold text-gray-700 dark:text-gray-300">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={submit}
                  disabled={!reason || submitting}
                  className={`flex-1 py-3.5 rounded-xl items-center ${!reason || submitting ? 'bg-gray-200 dark:bg-gray-700' : 'bg-[#EAAD11]'}`}
                >
                  {submitting ? <ActivityIndicator color="#000" /> : <Text className="font-bold text-black">Submit</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
