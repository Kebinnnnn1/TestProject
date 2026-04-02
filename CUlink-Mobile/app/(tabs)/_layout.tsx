import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNotifStore } from '../../store';
import { useTheme, Colors } from '../../constants';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size, badge }: { name: IoniconsName; color: string; size: number; badge?: number }) {
  return (
    <View style={tb.iconWrap}>
      <Ionicons name={name} size={24} color={color} />
      {!!badge && badge > 0 && (
        <View style={tb.badge}>
          <Text style={tb.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </View>
  );
}

function ChatIcon({ color }: { color: string }) {
  const unread = useNotifStore(s => s.unreadDMs);
  return <TabIcon name="chatbubbles-outline" color={color} size={24} badge={unread} />;
}

export default function TabsLayout() {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'android'
    ? Math.max(insets.bottom, 8)
    : Math.max(insets.bottom, 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: C.bgCard,
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: 58 + bottomPad,
          paddingBottom: bottomPad + 6,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="wall"
        options={{
          tabBarLabel: 'Wall',
          tabBarIcon: ({ color }) => (
            <TabIcon name="newspaper-outline" color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color }) => <ChatIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="workspace"
        options={{
          tabBarLabel: 'Workspace',
          tabBarIcon: ({ color }) => (
            <TabIcon name="grid-outline" color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => (
            <TabIcon name="person-outline" color={color} size={24} />
          ),
        }}
      />
    </Tabs>
  );
}

const tb = StyleSheet.create({
  iconWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center', width: 28, height: 28 },
  badge: {
    position: 'absolute', top: -3, right: -8,
    backgroundColor: Colors.error, borderRadius: 999,
    minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
