// Mobile port of AuthModal.jsx's Google sign-in flow (web's GoogleLogin +
// the google-confirm-signup / google-vendor steps), using
// @react-native-google-signin/google-signin's native sheet instead of web's
// GoogleLogin widget. See lib/googleAuth.ts for the client ID / native-build
// caveats — this cannot run inside Expo Go, so the button renders disabled
// there instead of crashing the screen.
import { useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { ensureGoogleSignInConfigured, getGoogleSignInModule } from '@/lib/googleAuth';
import { setToken } from '@/lib/storage';
import api from '@/lib/api';
import VendorUpgradeModal from '@/components/VendorUpgradeModal';

export default function GoogleSignInButton() {
  const { refreshUser } = useAuth();
  const { showToast, confirmToast } = useToast();
  const [loading, setLoading] = useState(false);
  const available = !!getGoogleSignInModule();
  const [vendorStepOpen, setVendorStepOpen] = useState(false);

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

      <VendorUpgradeModal visible={vendorStepOpen} onClose={() => setVendorStepOpen(false)} />
    </>
  );
}
