// Mobile port of App.jsx's dark-mode logic: an explicit user choice persists
// and wins; absent one, NativeWind's useColorScheme already defaults to the
// OS preference on its own, so there's nothing to do at startup in that case.
// Uses the same storage key name as web's localStorage key for consistency,
// though the two are obviously separate stores.
import { colorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'thrifter_dark_mode';

export async function restoreThemePreference() {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      colorScheme.set(saved);
    }
  } catch { /* noop */ }
}

export async function setThemePreference(pref: 'light' | 'dark') {
  colorScheme.set(pref);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, pref);
  } catch { /* noop */ }
}
