import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  const headerStyle = {
    backgroundColor: Colors[colorScheme ?? 'light'].background,
    borderBottomWidth: 1,
    borderBottomColor: '#838A2D',
  };

  const headerTitleStyle = {
    fontWeight: 'bold' as const,
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#FCFAF2',
        tabBarInactiveTintColor: '#FCFAF2',
        headerShown: true,
        headerStyle,
        headerTintColor: Colors[colorScheme ?? 'light'].text,
        headerTitleStyle,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#6A4028',
          paddingVertical: 10,
          paddingHorizontal: 10,
        },
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
