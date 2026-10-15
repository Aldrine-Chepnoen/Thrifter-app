// Sign in with Apple — required alongside Google Sign-In on iOS by App
// Store Review Guideline 4.8 (any app offering a third-party social login
// must also offer Apple's own). expo-apple-authentication is iOS-only: it
// renders nothing on Android (the module itself is safe to import there,
// unlike the bare-native google-signin package, but isAvailableAsync()
// always resolves false). Unlike Google, there's no per-platform client ID
// to configure here — the identity token's audience is just this app's
// bundle ID, verified server-side in /auth/apple.
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { router } from 'expo-router';
import { setToken } from '@/lib/storage';
import api from '@/lib/api';
import VendorUpgradeModal from '@/components/VendorUpgradeModal';

export default function AppleSignInButton() {
  const { refreshUser } = useAuth();
  const { showToast, confirmToast } = useToast();
  const [available, setAvailable] = useState(false);
  const [vendorStepOpen, setVendorStepOpen] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAvailable).catch(() => setAvailable(false));
  }, []);

  const doAppleAuth = async (identityToken: string, confirmSignup: boolean) => {
    try {
      const { data } = await api.post('/auth/apple', { identity_token: identityToken, confirm_signup: confirmSignup });
      if (data.needs_confirmation) {
        const ok = await confirmToast(
          `There's no Thrifter account for ${data.email}. Would you like to create one?`,
          'Create account',
        );
        if (ok) await doAppleAuth(identityToken, true);
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
      const msg = e?.response?.data?.detail ?? e?.message ?? 'Apple sign-in failed';
      showToast(msg, 'error');
    }
  };

  const handlePress = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        showToast('Could not get an Apple identity token. Please try again.', 'error');
        return;
      }
      await doAppleAuth(credential.identityToken, false);
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') return; // cancelled by user
      showToast('Apple sign-in failed. Please try again.', 'error');
    }
  };

  if (!available) return null;

  return (
    <>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={12}
        style={{ width: '100%', height: 50, marginTop: 10 }}
        onPress={handlePress}
      />

      <VendorUpgradeModal visible={vendorStepOpen} onClose={() => setVendorStepOpen(false)} />
    </>
  );
}
