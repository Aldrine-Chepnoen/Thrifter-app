import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import api from '@/lib/api';

const FRONTEND_BASE_URL = 'https://thrifter-ug.com';

export default function RegisterScreen() {
  const { register } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVendor, setIsVendor] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [vendorWhatsapp, setVendorWhatsapp] = useState('');
  const [vendorLocation, setVendorLocation] = useState('');
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUseMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showToast('Location permission is required to use this.', 'error');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const { data } = await api.post('/geocode/reverse', {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
      setVendorLocation(data.address);
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? 'Could not determine your address. Please type your pickup location instead.', 'error');
    } finally {
      setLocating(false);
    }
  };

  const handleRegister = async () => {
    if (!email || !password || !confirm) {
      showToast('Please fill in all fields', 'error');
      return;
    }
    if (password !== confirm) {
      showToast('Passwords do not match', 'error');
      return;
    }
    if (password.length < 8) {
      showToast('Password must be at least 8 characters', 'error');
      return;
    }
    if (isVendor && (!vendorName.trim() || !vendorWhatsapp.trim() || !vendorLocation.trim())) {
      showToast('Please provide your business name, phone number, and pickup location.', 'error');
      return;
    }
    setLoading(true);
    try {
      await register(email.trim().toLowerCase(), password, {
        isVendor,
        vendorName: vendorName.trim(),
        vendorWhatsapp: vendorWhatsapp.trim(),
        vendorLocation: vendorLocation.trim(),
      });
      router.replace('/(tabs)');
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? 'Registration failed. Please try again.';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-gray-900"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-3xl font-serif-bold text-[#EAAD11] mb-1">Thrifter</Text>
        <Text className="text-gray-400 dark:text-gray-500 mb-8">Create your account</Text>

        <GoogleSignInButton />

        <Text className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4 px-4 leading-relaxed">
          By continuing, you agree to discover and support local thrift brands, and to our{' '}
          <Text
            className="underline"
            onPress={() => Linking.openURL(`${FRONTEND_BASE_URL}/terms-and-conditions`)}
          >
            Terms & Conditions
          </Text>{' '}and{' '}
          <Text
            className="underline"
            onPress={() => Linking.openURL(`${FRONTEND_BASE_URL}/privacy-policy`)}
          >
            Privacy Policy
          </Text>.
        </Text>

        <View className="flex-row items-center gap-3 my-5">
          <View className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
          <Text className="text-xs text-gray-400 dark:text-gray-500">or continue with email</Text>
          <View className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
        </View>

        <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Email</Text>
        <TextInput
          className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3.5 mb-3 text-gray-900 dark:text-gray-100 text-base"
          placeholder="your@email.com"
          placeholderTextColor="#9CA3AF"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Password</Text>
        <View className="relative mb-3">
          <TextInput
            className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3.5 pr-12 text-gray-900 dark:text-gray-100 text-base"
            placeholder="••••••••"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-0 bottom-0 items-center justify-center"
          >
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Confirm Password</Text>
        <TextInput
          className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3.5 mb-4 text-gray-900 dark:text-gray-100 text-base"
          placeholder="••••••••"
          placeholderTextColor="#9CA3AF"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry={!showPassword}
        />

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
                className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3.5 text-gray-900 dark:text-gray-100 text-base"
                value={vendorName}
                onChangeText={setVendorName}
              />
            </View>
            <View>
              <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Vendor Phone Number</Text>
              <TextInput
                className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3.5 text-gray-900 dark:text-gray-100 text-base"
                placeholder="+256..."
                placeholderTextColor="#9CA3AF"
                value={vendorWhatsapp}
                onChangeText={setVendorWhatsapp}
                keyboardType="phone-pad"
              />
            </View>
            <View>
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300">Pickup Location</Text>
                <TouchableOpacity
                  onPress={handleUseMyLocation}
                  disabled={locating}
                  className="flex-row items-center gap-1"
                >
                  <Ionicons name="location-outline" size={14} color="#EAAD11" />
                  <Text className="text-sm font-bold text-[#EAAD11]">
                    {locating ? 'Locating…' : 'Use my location'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3.5 text-gray-900 dark:text-gray-100 text-base"
                placeholder="e.g. Kampala, Uganda"
                placeholderTextColor="#9CA3AF"
                value={vendorLocation}
                onChangeText={setVendorLocation}
              />
            </View>
          </View>
        )}

        <TouchableOpacity
          className="bg-black rounded-xl py-4 items-center mb-4 mt-4"
          onPress={handleRegister}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text className="text-white font-bold text-base">Create Account</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-center text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <Text className="text-[#EAAD11] font-semibold">Sign In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
