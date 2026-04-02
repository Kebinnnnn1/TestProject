import { Redirect } from 'expo-router';

/**
 * Root index — immediately redirect to the wall (auth guard in _layout.tsx
 * will bounce unauthenticated users back to login).
 */
export default function Index() {
  return <Redirect href="/(tabs)/wall" />;
}
