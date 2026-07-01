import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function ProfileScreen() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#EAAD11" />
      </View>
    );
  }

  if (!user) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-2xl font-bold text-gray-900 mb-2">Welcome to Thrifter</Text>
        <Text className="text-gray-400 text-center mb-8">
          Sign in to access your wardrobe and vote on requests
        </Text>
        <TouchableOpacity
          className="bg-[#EAAD11] rounded-xl py-4 w-full items-center mb-3"
          onPress={() => router.push('/auth/login')}
        >
          <Text className="text-white font-bold text-base">Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="border border-gray-200 rounded-xl py-4 w-full items-center"
          onPress={() => router.push('/auth/register')}
        >
          <Text className="text-gray-700 font-semibold text-base">Create Account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View className="flex-1 bg-white px-6 pt-16">
      <Text className="text-2xl font-bold text-gray-900 mb-1">Account</Text>
      <Text className="text-gray-400 mb-8">{user.email}</Text>

      {user.is_vendor && (
        <View className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-6">
          <Text className="text-yellow-700 font-semibold">Vendor account</Text>
        </View>
      )}

      <TouchableOpacity
        className="border border-red-200 rounded-xl py-4 items-center"
        onPress={handleLogout}
      >
        <Text className="text-red-500 font-semibold">Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}
