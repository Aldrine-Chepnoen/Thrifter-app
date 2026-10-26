import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import api from '@/lib/api';

// Foreground notifications are surfaced via the app's own ToastContext (see
// app/_layout.tsx) rather than the system banner, so the two don't double up
// while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Registers this device for push delivery — call once a user is logged in.
// Best-effort: a denied permission or a simulator/emulator with no push
// capability should never block the app, so every failure is swallowed.
export async function registerPushTokenAsync(): Promise<void> {
  try {
    if (!Device.isDevice) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });

    await api.post('/me/push-token', { token: expoPushToken });
  } catch {
    // Non-fatal — digest notifications just won't reach this device.
  }
}

export function addForegroundNotificationListener(
  onReceive: (title: string, body: string) => void
) {
  return Notifications.addNotificationReceivedListener((notification) => {
    const { title, body } = notification.request.content;
    onReceive(title ?? 'Thrifter', body ?? '');
  });
}
