import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function MenuRow({
  icon, label, onPress, danger = false,
}: {
  icon: IoniconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center px-4 py-4 bg-white"
    >
      <Ionicons name={icon} size={20} color={danger ? '#EF4444' : '#6B7280'} />
      <Text className={`flex-1 ml-3 text-base ${danger ? 'text-red-500' : 'text-gray-800'}`}>
        {label}
      </Text>
      {!danger && <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />}
    </TouchableOpacity>
  );
}

function Divider() {
  return <View className="h-px bg-gray-100 mx-4" />;
}

export default function ProfileScreen() {
  const { user, loading, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  // ── Logged-out ─────────────────────────────────────────────────────────────
  if (!loading && !user) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8" style={{ paddingTop: insets.top }}>
        <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
          <Ionicons name="person" size={36} color="#D1D5DB" />
        </View>
        <Text className="text-xl font-bold text-gray-900">Your Profile</Text>
        <Text className="text-gray-400 text-center mt-2 text-sm">
          Sign in to access your profile and settings
        </Text>
        <TouchableOpacity
          className="bg-[#EAAD11] rounded-xl py-4 w-full items-center mt-6"
          onPress={() => router.push('/auth/login')}
        >
          <Text className="text-white font-bold text-base">Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="py-4 w-full items-center mt-2"
          onPress={() => router.push('/auth/register')}
        >
          <Text className="text-gray-500 text-base">Create an account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!user) return null;

  const initial = user.email.split('@')[0][0].toUpperCase();

  return (
    <ScrollView className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white border-b border-gray-100 px-4 py-3">
        <Text className="text-2xl font-bold text-gray-900">Profile</Text>
      </View>

      {/* Avatar + identity */}
      <View
        className="bg-white mx-4 mt-4 rounded-2xl px-5 py-5 items-center"
        style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 }}
      >
        <View className="w-20 h-20 rounded-full bg-[#EAAD11] items-center justify-center mb-3">
          <Text className="text-3xl font-bold text-white">{initial}</Text>
        </View>

        <Text className="text-base text-gray-700 font-medium">{user.email}</Text>

        <View className="flex-row gap-2 mt-2">
          {user.is_vendor && (
            <View className="bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
              <Text className="text-xs font-semibold text-amber-700">Vendor</Text>
            </View>
          )}
          {user.is_admin && (
            <View className="bg-purple-50 border border-purple-200 rounded-full px-3 py-1">
              <Text className="text-xs font-semibold text-purple-700">Admin</Text>
            </View>
          )}
          {!user.is_vendor && !user.is_admin && (
            <View className="bg-gray-100 rounded-full px-3 py-1">
              <Text className="text-xs font-semibold text-gray-500">Shopper</Text>
            </View>
          )}
        </View>
      </View>

      {/* Vendor store link */}
      {user.is_vendor && user.vendor_name && (
        <View
          className="bg-white mx-4 mt-4 rounded-2xl overflow-hidden"
          style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 }}
        >
          <MenuRow
            icon="storefront-outline"
            label={`My Store — ${user.vendor_name}`}
            onPress={() => router.push(`/vendor/${encodeURIComponent(user.vendor_name!)}`)}
          />
        </View>
      )}

      {/* Navigation shortcuts */}
      <View
        className="bg-white mx-4 mt-4 rounded-2xl overflow-hidden"
        style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 }}
      >
        <MenuRow
          icon="heart-outline"
          label="Wardrobe"
          onPress={() => router.push('/(tabs)/wardrobe')}
        />
        <Divider />
        <MenuRow
          icon="stats-chart-outline"
          label="Demand Board"
          onPress={() => router.push('/(tabs)/polls')}
        />
      </View>

      {/* Log out */}
      <View
        className="bg-white mx-4 mt-4 rounded-2xl overflow-hidden"
        style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 }}
      >
        <MenuRow icon="log-out-outline" label="Log Out" onPress={handleLogout} danger />
      </View>

      <View className="pb-10" />
    </ScrollView>
  );
}
