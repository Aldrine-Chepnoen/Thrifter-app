// Mobile port of the cart state frontend/src/App.jsx owns (cartItems + the
// add/remove/updateQuantity/updateNote helpers) plus its localStorage
// persistence — combined into one context since mobile has no root
// component to hang this state off of. AsyncStorage stands in for
// localStorage; everything else (shape, behavior) matches the web cart.
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Item } from '@/components/ItemCard';

const STORAGE_KEY = 'thrifter_cart';

export type CartItem = Item & { cartQuantity: number; cartNote?: string };

type CartContextType = {
  cartItems: CartItem[];
  loaded: boolean;
  addToCart: (item: Item, qty?: number) => void;
  removeFromCart: (itemId: number) => void;
  updateQuantity: (itemId: number, qty: number) => void;
  updateNote: (itemId: number, note: string) => void;
  clearCart: () => void;
  isInCart: (itemId: number) => boolean;
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setCartItems(JSON.parse(raw));
      } catch { /* noop */ }
      finally { setLoaded(true); }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return; // don't clobber storage with [] before the initial load resolves
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems)).catch(() => {});
  }, [cartItems, loaded]);

  const addToCart = useCallback((item: Item, qty = 1) => {
    setCartItems((prev) => (prev.some((i) => i.id === item.id) ? prev : [...prev, { ...item, cartQuantity: qty }]));
  }, []);

  const removeFromCart = useCallback((itemId: number) => {
    setCartItems((prev) => prev.filter((i) => i.id !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId: number, qty: number) => {
    setCartItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, cartQuantity: qty } : i)));
  }, []);

  const updateNote = useCallback((itemId: number, note: string) => {
    setCartItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, cartNote: note } : i)));
  }, []);

  const clearCart = useCallback(() => setCartItems([]), []);

  const isInCart = useCallback((itemId: number) => cartItems.some((i) => i.id === itemId), [cartItems]);

  return (
    <CartContext.Provider value={{ cartItems, loaded, addToCart, removeFromCart, updateQuantity, updateNote, clearCart, isInCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
