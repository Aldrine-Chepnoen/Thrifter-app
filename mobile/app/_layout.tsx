import "../global.css";
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { PlayfairDisplay_400Regular, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import 'react-native-reanimated';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { ToastProvider, useToast } from '@/context/ToastContext';
import { initImageHost } from '@/lib/imageHost';
import { restoreThemePreference } from '@/lib/theme';
import { addForegroundNotificationListener } from '@/lib/push';

// Shows a toast for any push notification received while the app is
// foregrounded (see lib/push.ts's notification handler, which suppresses
// the system banner so this doesn't double up with it).
function ForegroundNotifications() {
  const { showToast } = useToast();
  useEffect(() => {
    const sub = addForegroundNotificationListener((_title, body) => showToast(body, 'info'));
    return () => sub.remove();
  }, [showToast]);
  return null;
}

export const unstable_settings = {
  anchor: '(tabs)',
};

// Matches the website's font pairing (frontend/tailwind.config.js: DM Sans /
// Playfair Display) — held behind the splash screen so nothing renders in
// the system fallback font first and re-flows once these load.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    PlayfairDisplay_400Regular,
    PlayfairDisplay_700Bold,
  });

  useEffect(() => { initImageHost(); }, []);
  useEffect(() => { restoreThemePreference(); }, []);
  useEffect(() => { if (fontsLoaded) SplashScreen.hideAsync(); }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ToastProvider>
      <ForegroundNotifications />
      <AuthProvider>
        <CartProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="auth/login" options={{ headerShown: false }} />
            <Stack.Screen name="auth/register" options={{ headerShown: false }} />
            <Stack.Screen name="item/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="vendor/[name]" options={{ headerShown: false }} />
            <Stack.Screen name="upload" options={{ headerShown: false }} />
            <Stack.Screen name="edit/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="checkout" options={{ headerShown: false }} />
            <Stack.Screen name="checkout/complete" options={{ headerShown: false }} />
            <Stack.Screen name="orders" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="auto" />
        </CartProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
