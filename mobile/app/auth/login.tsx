import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import GoogleSignInButton from '@/components/GoogleSignInButton';

const FRONTEND_BASE_URL = 'https://thrifter-ug.com';

export default function LoginScreen() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      showToast('Please fill in all fields', 'error');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? 'Login failed. Please try again.';
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
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-serif-bold text-[#EAAD11] mb-1">Thrifter</Text>
        <Text className="text-gray-400 dark:text-gray-500 mb-8">Sign in to your account</Text>

        <GoogleSignInButton />

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
        <View className="relative mb-6">
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

        <TouchableOpacity
          className="bg-black rounded-xl py-4 items-center mb-4"
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text className="text-white font-bold text-base">Sign In</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/auth/register')}>
          <Text className="text-center text-gray-500 dark:text-gray-400">
            Don't have an account?{' '}
            <Text className="text-[#EAAD11] font-semibold">Register</Text>
          </Text>
        </TouchableOpacity>

        <Text className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6 px-4 leading-relaxed">
          By continuing, you agree to our{' '}
          <Text
            className="underline"
            onPress={() => Linking.openURL(`${FRONTEND_BASE_URL}/thrifter-terms-and-conditions.pdf`)}
          >
            Terms & Conditions
          </Text>{' '}and{' '}
          <Text
            className="underline"
            onPress={() => Linking.openURL(`${FRONTEND_BASE_URL}/thrifter-privacy-policy.pdf`)}
          >
            Privacy Policy
          </Text>.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
