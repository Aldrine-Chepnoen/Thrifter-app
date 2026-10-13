// NativeWind's `dark:` variants only work on className strings — icon
// `color` props and inline `style` color values need the active scheme at
// the JS level instead. Small shared palette so every screen branches the
// same handful of icon/text tones instead of re-guessing hex pairs.
import { useColorScheme } from 'nativewind';

export function useThemeColors() {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  return {
    dark,
    // Primary icon/text tone (e.g. the cart bag, back arrows) — near-black on
    // light, near-white on dark.
    icon: dark ? '#F3F4F6' : '#111827',
    // Muted/secondary icon tone (e.g. search, menu, placeholders).
    iconMuted: dark ? '#9CA3AF' : '#6B7280',
    // Subtlest icon tone (e.g. disabled states, faint dividers' icons).
    iconFaint: dark ? '#6B7280' : '#9CA3AF',
    // Page/chrome surface (e.g. the tab bar) — mirrors bg-white dark:bg-gray-900.
    surface: dark ? '#111827' : '#FFFFFF',
    // Hairline border against that surface — mirrors border-gray-100 dark:border-gray-800.
    border: dark ? '#1F2937' : '#F3F4F6',
  };
}
