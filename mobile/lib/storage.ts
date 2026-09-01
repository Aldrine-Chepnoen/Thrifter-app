import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'thrifter_token';

// expo-secure-store has no web implementation (Keychain/Keystore don't
// exist there) — its web shim throws on delete. localStorage is the
// standard fallback Expo's own docs recommend for the web build app.json
// already targets; native platforms keep using the real secure store.
const isWeb = Platform.OS === 'web';

export const getToken = () =>
  isWeb ? Promise.resolve(localStorage.getItem(TOKEN_KEY)) : SecureStore.getItemAsync(TOKEN_KEY);

export const setToken = (token: string) =>
  isWeb ? Promise.resolve(localStorage.setItem(TOKEN_KEY, token)) : SecureStore.setItemAsync(TOKEN_KEY, token);

export const deleteToken = () =>
  isWeb ? Promise.resolve(localStorage.removeItem(TOKEN_KEY)) : SecureStore.deleteItemAsync(TOKEN_KEY);
