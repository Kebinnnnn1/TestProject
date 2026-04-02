import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ──────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  email: string;
  display_name: string;
  university: string;
  avatar_url: string;
  role: string;
  is_verified: boolean;
  date_joined: string;
  post_count: number;
}

// ── Auth Store ─────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isHydrated: boolean;

  setAuth: (user: User, access: string, refresh: string) => Promise<void>;
  clearAuth: () => Promise<void>;
  setUser: (user: User) => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  isHydrated: false,

  setAuth: async (user, access, refresh) => {
    await AsyncStorage.setItem('access_token', access);
    await AsyncStorage.setItem('refresh_token', refresh);
    await AsyncStorage.setItem('user', JSON.stringify(user));
    set({ user, accessToken: access, refreshToken: refresh });
  },

  clearAuth: async () => {
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('refresh_token');
    await AsyncStorage.removeItem('user');
    set({ user: null, accessToken: null, refreshToken: null });
  },

  setUser: (user) => {
    AsyncStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },

  hydrate: async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const rtoken = await AsyncStorage.getItem('refresh_token');
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      set({ accessToken: token, refreshToken: rtoken, user, isHydrated: true });
    } catch {
      set({ isHydrated: true });
    }
  },
}));

// ── Notification Store ─────────────────────────────────────────────────────

interface NotifState {
  unreadDMs: number;
  setUnreadDMs: (n: number) => void;
  incrementUnreadDMs: () => void;
  clearUnreadDMs: () => void;
}

export const useNotifStore = create<NotifState>((set) => ({
  unreadDMs: 0,
  setUnreadDMs: (n) => set({ unreadDMs: n }),
  incrementUnreadDMs: () => set((s) => ({ unreadDMs: s.unreadDMs + 1 })),
  clearUnreadDMs: () => set({ unreadDMs: 0 }),
}));

// ── Theme Store ────────────────────────────────────────────────────────────

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
  hydrate: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: true, // default dark

  toggle: () => {
    const next = !get().isDark;
    AsyncStorage.setItem('theme', next ? 'dark' : 'light').catch(() => {});
    set({ isDark: next });
  },

  hydrate: async () => {
    try {
      const saved = await AsyncStorage.getItem('theme');
      if (saved === 'light') set({ isDark: false });
      else set({ isDark: true }); // default dark if nothing saved
    } catch {
      set({ isDark: true });
    }
  },
}));
