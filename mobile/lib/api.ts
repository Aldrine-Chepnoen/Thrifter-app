import axios from 'axios';
import { getToken } from './storage';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'https://thrifter-app-production.up.railway.app',
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
