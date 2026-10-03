import { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, Animated } from 'react-native';
import type { ColorValue } from 'react-native';
import { useCart } from '@/context/CartContext';
import { useThemeColors } from '@/hooks/use-theme-colors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color }: { name: IoniconName; color: ColorValue }) {
  return <Ionicons name={name} size={24} color={color} />;
}

// Cart tab's icon carries its own badge (count, visible from every tab —
// previously the cart was only reachable/visible via the Home tab's header)
// and a one-shot pulse whenever an item is actually added, driven by
// CartContext's `pulseKey` rather than the count itself (so removing an item
// doesn't also pulse).
function CartTabIcon({ color }: { color: ColorValue }) {
  const { cartItems, pulseKey } = useCart();
  const scale = useRef(new Animated.Value(1)).current;
  const count = cartItems.length;

  useEffect(() => {
    if (pulseKey === 0) return; // skip the initial mount value
    scale.setValue(1);
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.35, useNativeDriver: true, speed: 30, bounciness: 12 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseKey]);

  return (
    <View style={{ width: 24, height: 24 }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name="bag-outline" size={24} color={color} />
      </Animated.View>
      {count > 0 && (
        <View
          style={{
            position: 'absolute', top: -4, right: -8, backgroundColor: '#EAAD11',
            borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
            paddingHorizontal: 3,
          }}
        >
          <Text style={{ color: '#000', fontSize: 10, fontWeight: '700' }}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </View>
  );
}

export default function TabLayout() {
  const themeColors = useThemeColors();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#EAAD11',
        tabBarInactiveTintColor: themeColors.iconMuted,
        headerShown: false,
        tabBarStyle: { backgroundColor: themeColors.surface, borderTopColor: themeColors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color }) => <CartTabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="polls"
        options={{
          title: 'Polls',
          tabBarIcon: ({ color }) => <TabIcon name="stats-chart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="wardrobe"
        options={{
          title: 'Wardrobe',
          tabBarIcon: ({ color }) => <TabIcon name="heart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon name="person" color={color} />,
        }}
      />
    </Tabs>
  );
}
