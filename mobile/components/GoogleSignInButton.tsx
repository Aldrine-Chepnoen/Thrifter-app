// Mobile port of AuthModal.jsx's Google sign-in flow (web's GoogleLogin +
// the google-confirm-signup / google-vendor steps), using
// @react-native-google-signin/google-signin's native sheet instead of web's
// GoogleLogin widget. See lib/googleAuth.ts for the client ID / native-build
// caveats — this cannot run inside Expo Go, so the button renders disabled
// there instead of crashing the screen.
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { ensureGoogleSignInConfigured, getGoogleSignInModule } from '@/lib/googleAuth';
import { setToken } from '@/lib/storage';
import api from '@/lib/api';

export default function GoogleSignInButton() {
  const { refreshUser } = useAuth();
  const { showToast, confirmToast } = useToast();
  const [loading, setLoading] = useState(false);
  const available = !!getGoogleSignInModule();
  const [vendorStepOpen, setVendorStepOpen] = useState(false);
  const [isVendor, setIsVendor] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [vendorWhatsapp, setVendorWhatsapp] = useState('');
  const [vendorLocation, setVendorLocation] = useState('');
  const [vendorSubmitting, setVendorSubmitting] = useState(false);

  const finishAndGoHome = () => {
    setVendorStepOpen(false);
    router.replace('/(tabs)');
  };

  const doGoogleAuth = async (credential: string, confirmSignup: boolean) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/google', { credential, confirm_signup: confirmSignup });
      if (data.needs_confirmation) {
        setLoading(false);
        const ok = await confirmToast(
          `There's no Thrifter account for ${data.email}. Would you like to create one?`,
          'Create account',
        );
        if (ok) await doGoogleAuth(credential, true);
        return;
      }
      await setToken(data.access_token);
      await refreshUser();
      if (data.is_new_user) {
        setVendorStepOpen(true);
      } else {
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? 'Google sign-in failed';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePress = async () => {
    const mod = getGoogleSignInModule();
    if (!mod) {
      showToast(
        "Google Sign-In needs the app's own native build — it doesn't work inside Expo Go. Use email/password for now.",
        'info',
      );
      return;
    }
    if (!ensureGoogleSignInConfigured()) return;
    const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = mod;
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return; // cancelled by user
      const idToken = response.data.idToken;
      if (!idToken) {
        showToast('Could not get a Google ID token. Please try again.', 'error');
        return;
      }
      await doGoogleAuth(idToken, false);
    } catch (error) {
      if (isErrorWithCode(error)) {
        if (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS) {
          return;
        }
        showToast('Google sign-in failed. Please try again.', 'error');
      } else {
        showToast('Google sign-in failed. Please try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
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
    <>
      <TouchableOpacity
        onPress={handlePress}
        disabled={loading}
        className="flex-row items-center justify-center gap-2 border border-gray-200 dark:border-gray-700 rounded-xl py-3.5"
        style={{ opacity: loading ? 0.6 : 1 }}
      >
        {loading ? (
          <ActivityIndicator color="#111" size="small" />
        ) : (
          <>
            <Ionicons name="logo-google" size={18} color={available ? '#111' : '#9CA3AF'} />
            <Text className={available ? 'text-gray-900 dark:text-gray-100 font-semibold' : 'text-gray-400 dark:text-gray-500 font-semibold'}>
              {available ? 'Continue with Google' : 'Continue with Google (needs dev build)'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <Modal visible={vendorStepOpen} animationType="slide" transparent onRequestClose={finishAndGoHome}>
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
    </>
  );
}
