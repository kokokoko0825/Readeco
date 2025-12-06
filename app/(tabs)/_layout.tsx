import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '本棚',
          tabBarIcon: ({ color }) => <Ionicons name="library" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="New"
        options={{
          title: '新刊',
          tabBarIcon: ({ color }) => <MaterialIcons name="fiber-new" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="Friends"
        options={{
          title: 'フレンド',
          tabBarIcon: ({ color }) => <MaterialIcons name="people" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="登録"
        options={{
          title: '登録',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="barcode-scan" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="Settings"
        options={{
          title: '設定',
          tabBarIcon: ({ color }) => <MaterialIcons name="settings" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}
