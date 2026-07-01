import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '@/lib/api';
import { getToken, setToken, deleteToken } from '@/lib/storage';

type User = {
  id: number;
  email: string;
  is_vendor: boolean;
  is_admin: boolean;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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

  const register = async (email: string, password: string) => {
    await api.post('/auth/register', { email, password });
    await login(email, password);
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    await deleteToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
