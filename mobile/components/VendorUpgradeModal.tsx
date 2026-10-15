// Shown right after a brand-new account is created via a social sign-in
// (Google or Apple), offering the same vendor-upgrade step the
// password-registration flow already has. Shared by GoogleSignInButton and
// AppleSignInButton so the two social flows don't diverge.
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import api from '@/lib/api';

export default function VendorUpgradeModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { refreshUser } = useAuth();
  const { showToast } = useToast();
  const [isVendor, setIsVendor] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [vendorWhatsapp, setVendorWhatsapp] = useState('');
  const [vendorLocation, setVendorLocation] = useState('');
  const [vendorSubmitting, setVendorSubmitting] = useState(false);

  const finishAndGoHome = () => {
    onClose();
    router.replace('/(tabs)');
  };

  const handleVendorUpgrade = async () => {
    if (!vendorName.trim() || !vendorWhatsapp.trim() || !vendorLocation.trim()) {
      showToast('Please provide your business name, phone number, and pickup location.', 'error');
      return;
    }
    setVendorSubmitting(true);
    try {
      await api.post('/auth/vendor-upgrade', {
        vendor_name: vendorName.trim(),
        vendor_whatsapp: vendorWhatsapp.trim(),
        vendor_location: vendorLocation.trim(),
      });
      await refreshUser();
      finishAndGoHome();
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? 'Could not save vendor details';
      showToast(msg, 'error');
    } finally {
      setVendorSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={finishAndGoHome}>
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-white dark:bg-gray-900 rounded-t-3xl px-6 pt-5 pb-8">
          <Text className="text-xl font-bold text-gray-900 dark:text-white mb-1">One more thing</Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400 mb-4">Are you a business or brand selling on Thrifter?</Text>

          <TouchableOpacity
            className="flex-row items-center gap-3 py-2 mb-2"
            onPress={() => setIsVendor((v) => !v)}
          >
            <View className={`w-5 h-5 rounded items-center justify-center border ${isVendor ? 'bg-black border-black' : 'border-gray-300 dark:border-gray-600'}`}>
              {isVendor && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">I am a Business/Brand</Text>
          </TouchableOpacity>

          {isVendor && (
            <View className="gap-3 mb-2">
              <View>
                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Business/brand name</Text>
                <TextInput
                  className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 text-base"
                  value={vendorName}
                  onChangeText={setVendorName}
                />
              </View>
              <View>
                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Vendor Phone Number</Text>
                <TextInput
                  className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 text-base"
                  placeholder="+256..."
                  placeholderTextColor="#9CA3AF"
                  value={vendorWhatsapp}
                  onChangeText={setVendorWhatsapp}
                  keyboardType="phone-pad"
                />
              </View>
              <View>
                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Pickup Location</Text>
                <TextInput
                  className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 text-base"
                  placeholder="e.g. Kampala, Uganda"
                  placeholderTextColor="#9CA3AF"
                  value={vendorLocation}
                  onChangeText={setVendorLocation}
                />
              </View>
            </View>
          )}

          <TouchableOpacity
            disabled={vendorSubmitting}
            onPress={isVendor ? handleVendorUpgrade : finishAndGoHome}
            className="bg-black rounded-xl py-4 items-center mt-4"
            style={{ opacity: vendorSubmitting ? 0.6 : 1 }}
          >
            {vendorSubmitting
              ? <ActivityIndicator color="#fff" />
              : <Text className="text-white font-bold">{isVendor ? 'Finish' : 'Skip for now'}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
