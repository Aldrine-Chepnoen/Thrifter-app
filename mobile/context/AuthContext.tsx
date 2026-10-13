import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '@/lib/api';
import { getToken, setToken, deleteToken } from '@/lib/storage';

type User = {
  id: number;
  email: string;
  is_vendor: boolean;
  is_admin: boolean;
  vendor_name?: string | null;
  vendor_whatsapp?: string | null;
};

type VendorSignupOptions = {
  isVendor: boolean;
  vendorName?: string;
  vendorWhatsapp?: string;
  vendorLocation?: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, vendorOptions?: VendorSignupOptions) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  // Re-fetches /auth/me after a token was already stored by a flow other
  // than login()/register() — used by Google sign-in, which gets its
  // access_token back from /auth/google rather than /auth/login.
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          const { data } = await api.get('/auth/me');
          setUser(data);
        }
      } catch {
        await deleteToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const form = new URLSearchParams();
    form.append('email', email);
    form.append('password', password);
    const { data } = await api.post('/auth/login', form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    await setToken(data.access_token);
    const { data: me } = await api.get('/auth/me');
    setUser(me);
  };

  const register = async (email: string, password: string, vendorOptions?: VendorSignupOptions) => {
    await api.post('/auth/register', {
      email,
      password,
      is_vendor: vendorOptions?.isVendor ?? false,
      vendor_name: vendorOptions?.isVendor ? vendorOptions.vendorName : null,
      vendor_whatsapp: vendorOptions?.isVendor ? vendorOptions.vendorWhatsapp : null,
      vendor_location: vendorOptions?.isVendor ? vendorOptions.vendorLocation : null,
    });
    await login(email, password);
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    await deleteToken();
    setUser(null);
  };

  // Unlike logout, errors here are NOT swallowed — a vendor with an
  // outstanding balance, an unresolved withdrawal, or an order in flight
  // gets a 409 with a specific reason the caller should show, rather than
  // silently doing nothing.
  const deleteAccount = async () => {
    await api.delete('/auth/me');
    await deleteToken();
    setUser(null);
  };

  const refreshUser = async () => {
    const { data } = await api.get('/auth/me');
    setUser(data);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, deleteAccount, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
