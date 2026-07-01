import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'thrifter_token';

export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const setToken = (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token);
export const deleteToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);
