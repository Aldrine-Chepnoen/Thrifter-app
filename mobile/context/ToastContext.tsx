// Mobile port of frontend/src/context/ToastContext.jsx — a single, consistent
// non-blocking feedback mechanism, replacing both Alert.alert (which blocks
// interaction with a native dialog web doesn't use) and the inline
// `<Text className="text-red-600">` error blocks scattered through forms
// (which could scroll out of view or sit behind the keyboard — this is what
// was reported as error text "at the bottom of the screen seems cut off").
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';

const DURATION_MS = 5000;

type ToastType = 'error' | 'success' | 'info';

type ToastEntry = {
  id: number;
  message: string;
  type: ToastType;
  opacity: Animated.Value;
};

type ConfirmEntry = {
  id: number;
  message: string;
  confirmLabel: string;
  resolve: (ok: boolean) => void;
};

type ToastContextType = {
  showToast: (message: string, type?: ToastType) => void;
  confirmToast: (message: string, confirmLabel?: string) => Promise<boolean>;
};

const ToastContext = createContext<ToastContextType | null>(null);

// Light/dark pairs mirror frontend/src/context/ToastContext.jsx's own
// `dark:` classes (red/green/blue -50/-200/-700 in light, -900/30 bg with
// -300 text in dark) — `Ionicons`'/`View style` color props can't take
// NativeWind's `dark:` variants directly, so the pair is picked in JS instead.
const STYLES: Record<ToastType, { bg: string; border: string; text: string; icon: keyof typeof Ionicons.glyphMap; iconColor: string }> = {
  error: { bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C', icon: 'alert-circle', iconColor: '#DC2626' },
  success: { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D', icon: 'checkmark-circle', iconColor: '#16A34A' },
  info: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8', icon: 'information-circle', iconColor: '#2563EB' },
};

const DARK_STYLES: Record<ToastType, { bg: string; border: string; text: string; icon: keyof typeof Ionicons.glyphMap; iconColor: string }> = {
  error: { bg: 'rgba(127,29,29,0.3)', border: 'rgba(153,27,27,0.6)', text: '#FCA5A5', icon: 'alert-circle', iconColor: '#F87171' },
  success: { bg: 'rgba(20,83,45,0.3)', border: 'rgba(22,101,52,0.6)', text: '#86EFAC', icon: 'checkmark-circle', iconColor: '#4ADE80' },
  info: { bg: 'rgba(30,58,138,0.3)', border: 'rgba(29,78,216,0.6)', text: '#93C5FD', icon: 'information-circle', iconColor: '#60A5FA' },
};

const CONFIRM_LIGHT = { bg: '#FFFFFF', border: '#E5E7EB', text: '#1F2937', cancel: '#6B7280', confirm: '#111827' };
const CONFIRM_DARK = { bg: '#1F2937', border: '#374151', text: '#F3F4F6', cancel: '#9CA3AF', confirm: '#F9FAFB' };

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const confirmPalette = dark ? CONFIRM_DARK : CONFIRM_LIGHT;
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const [confirm, setConfirm] = useState<ConfirmEntry | null>(null);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'error') => {
    const id = nextId++;
    const opacity = new Animated.Value(0);
    setToasts((prev) => [...prev, { id, message, type, opacity }]);
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    const timer = setTimeout(() => dismiss(id), DURATION_MS);
    timers.current.set(id, timer);
  }, [dismiss]);

  const confirmToast = useCallback((message: string, confirmLabel = 'Confirm') => {
    return new Promise<boolean>((resolve) => {
      const id = nextId++;
      setConfirm({ id, message, confirmLabel, resolve });
    });
  }, []);

  const resolveConfirm = (ok: boolean) => {
    confirm?.resolve(ok);
    setConfirm(null);
  };

  return (
    <ToastContext.Provider value={{ showToast, confirmToast }}>
      {children}
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0, alignItems: 'center', zIndex: 1000 }}
      >
        {toasts.map((toast) => {
          const style = (dark ? DARK_STYLES : STYLES)[toast.type];
          return (
            <Animated.View
              key={toast.id}
              style={{
                opacity: toast.opacity,
                backgroundColor: style.bg,
                borderColor: style.border,
                borderWidth: 1,
                borderRadius: 12,
                marginBottom: 8,
                width: '92%',
                maxWidth: 420,
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 10,
                paddingHorizontal: 12,
                shadowColor: '#000',
                shadowOpacity: 0.1,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 3,
              }}
            >
              <Ionicons name={style.icon} size={18} color={style.iconColor} style={{ marginRight: 8 }} />
              <Text style={{ color: style.text, flex: 1, fontSize: 13, fontWeight: '500' }}>{toast.message}</Text>
              <TouchableOpacity onPress={() => dismiss(toast.id)} style={{ padding: 4 }}>
                <Ionicons name="close" size={16} color={style.text} />
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      {confirm && (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0, alignItems: 'center', zIndex: 1001 }}
        >
          <View
            style={{
              backgroundColor: confirmPalette.bg, borderColor: confirmPalette.border, borderWidth: 1, borderRadius: 12,
              width: '92%', maxWidth: 420, padding: 14,
              shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
            }}
          >
            <Text style={{ color: confirmPalette.text, fontSize: 13, marginBottom: 12 }}>{confirm.message}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => resolveConfirm(false)} style={{ paddingVertical: 6, paddingHorizontal: 10 }}>
                <Text style={{ color: confirmPalette.cancel, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => resolveConfirm(true)} style={{ paddingVertical: 6, paddingHorizontal: 10 }}>
                <Text style={{ color: confirmPalette.confirm, fontWeight: '700', fontSize: 13 }}>{confirm.confirmLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
