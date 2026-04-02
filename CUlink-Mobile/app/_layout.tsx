import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store';

export default function RootLayout() {
  const { user, isHydrated, hydrate } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    hydrate();
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
      <StatusBar style="light" backgroundColor="#0f1117" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
