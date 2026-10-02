import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { setThemePreference } from '@/lib/theme';

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
      className="flex-row items-center px-4 py-4 bg-white dark:bg-gray-900"
    >
      <Ionicons name={icon} size={20} color={danger ? '#EF4444' : '#6B7280'} />
      <Text className={`flex-1 ml-3 text-base ${danger ? 'text-red-500' : 'text-gray-800 dark:text-gray-200'}`}>
        {label}
      </Text>
      {!danger && <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />}
    </TouchableOpacity>
  );
}

function Divider() {
  return <View className="h-px bg-gray-100 dark:bg-gray-800 mx-4" />;
}

export default function ProfileScreen() {
  const { user, loading, logout, deleteAccount } = useAuth();
  const { showToast, confirmToast } = useToast();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';

  const handleToggleTheme = () => {
    toggleColorScheme();
    setThemePreference(isDark ? 'light' : 'dark');
  };

  const handleLogout = async () => {
    const ok = await confirmToast('Are you sure you want to log out?', 'Log Out');
    if (!ok) return;
    await logout();
    router.replace('/auth/login');
  };

  const handleDeleteAccount = async () => {
    const ok = await confirmToast(
      'This permanently deletes your Thrifter account. This cannot be undone.',
      'Delete',
    );
    if (!ok) return;
    try {
      await deleteAccount();
      router.replace('/auth/login');
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? 'Could not delete account. Please try again.', 'error');
    }
  };

  // ── Logged-out ─────────────────────────────────────────────────────────────
  if (!loading && !user) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900 px-8" style={{ paddingTop: insets.top }}>
        <View className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center mb-4">
          <Ionicons name="person" size={36} color="#D1D5DB" />
        </View>
        <Text className="text-xl font-bold text-gray-900 dark:text-white">Your Profile</Text>
        <Text className="text-gray-400 dark:text-gray-500 text-center mt-2 text-sm">
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
          <Text className="text-gray-500 dark:text-gray-400 text-base">Create an account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!user) return null;

  const initial = user.email.split('@')[0][0].toUpperCase();

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-900" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3">
        <Text className="text-2xl font-serif-bold text-gray-900 dark:text-white">Profile</Text>
      </View>

      {/* Avatar + identity */}
      <View className="bg-white dark:bg-gray-900 mx-4 mt-4 rounded-2xl border border-gray-100 dark:border-gray-800 px-5 py-5 items-center">
        <View className="w-20 h-20 rounded-full bg-[#EAAD11] items-center justify-center mb-3">
          <Text className="text-3xl font-bold text-white">{initial}</Text>
        </View>

        <Text className="text-base text-gray-700 dark:text-gray-300 font-medium">{user.email}</Text>

        <View className="flex-row gap-2 mt-2">
          {user.is_vendor && (
            <View className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-full px-3 py-1">
              <Text className="text-xs font-semibold text-amber-700 dark:text-amber-400">Vendor</Text>
            </View>
          )}
          {user.is_admin && (
            <View className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-full px-3 py-1">
              <Text className="text-xs font-semibold text-purple-700 dark:text-purple-400">Admin</Text>
            </View>
          )}
          {!user.is_vendor && !user.is_admin && (
            <View className="bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1">
              <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400">Shopper</Text>
            </View>
          )}
        </View>
      </View>

      {/* Appearance */}
      <View className="bg-white dark:bg-gray-900 mx-4 mt-4 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <TouchableOpacity
          onPress={handleToggleTheme}
          className="flex-row items-center px-4 py-4 bg-white dark:bg-gray-900"
        >
          <Ionicons name={isDark ? 'moon' : 'sunny-outline'} size={20} color={isDark ? '#EAAD11' : '#6B7280'} />
          <Text className="flex-1 ml-3 text-base text-gray-800 dark:text-gray-200">
            {isDark ? 'Dark Mode' : 'Light Mode'}
          </Text>
          <View className={`w-11 h-6 rounded-full justify-center px-0.5 ${isDark ? 'bg-[#EAAD11] items-end' : 'bg-gray-200 dark:bg-gray-700 items-start'}`}>
            <View className="w-5 h-5 rounded-full bg-white" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Vendor store link */}
      {user.is_vendor && user.vendor_name && (
        <View className="bg-white dark:bg-gray-900 mx-4 mt-4 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <MenuRow
            icon="storefront-outline"
            label={`My Store — ${user.vendor_name}`}
            onPress={() => router.push(`/vendor/${encodeURIComponent(user.vendor_name!)}`)}
          />
        </View>
      )}

      {/* Navigation shortcuts */}
      <View className="bg-white dark:bg-gray-900 mx-4 mt-4 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <MenuRow
          icon="heart-outline"
          label="Wardrobe"
          onPress={() => router.push('/(tabs)/wardrobe')}
        />
        <Divider />
        <MenuRow
          icon="receipt-outline"
          label="My Orders"
          onPress={() => router.push('/orders')}
        />
        <Divider />
        <MenuRow
          icon="stats-chart-outline"
          label="Demand Board"
          onPress={() => router.push('/(tabs)/polls')}
        />
      </View>

      {/* Log out */}
      <View className="bg-white dark:bg-gray-900 mx-4 mt-4 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <MenuRow icon="log-out-outline" label="Log Out" onPress={handleLogout} danger />
      </View>

      {/* Delete account — kept separate from Log Out so it isn't an easy
          mis-tap; required by Google Play's account deletion policy. */}
      <View className="bg-white dark:bg-gray-900 mx-4 mt-4 rounded-2xl border border-red-200 dark:border-red-900 overflow-hidden">
        <MenuRow icon="trash-outline" label="Delete Account" onPress={handleDeleteAccount} danger />
      </View>

      <View className="pb-10" />
    </ScrollView>
  );
}
