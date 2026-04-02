import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore, useThemeStore } from '../store';

export default function RootLayout() {
  const { user, isHydrated, hydrate } = useAuthStore();
  const { isDark, hydrate: hydrateTheme } = useThemeStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    hydrate();
    hydrateTheme(); // load saved theme preference from AsyncStorage
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)/wall');
    }
  }, [user, isHydrated]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={isDark ? '#111114' : '#f5f5f7'} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
