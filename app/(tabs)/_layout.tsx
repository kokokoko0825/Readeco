import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { Icon } from '@/components/Icon';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  const headerStyle = {
    backgroundColor: Colors[colorScheme ?? 'light'].background,
    borderBottomWidth: 1,
    borderBottomColor: '#838A2D',
  };

  const headerTitleStyle = {
    fontWeight: 'bold' as const,
    textAlign: 'center' as const,
    alignSelf: 'center' as const,
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
        headerTitleAlign: 'center' as const,
        tabBarButton: HapticTab,
        tabBarLabelPosition: 'below-icon',
        tabBarItemStyle: {
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 4,
        },
        tabBarIconStyle: {
          marginBottom: 4,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginTop: 4,
        },
        tabBarStyle: {
          backgroundColor: '#6A4028',
          paddingVertical: 16,
          paddingHorizontal: 10,
          height: 133,
          paddingBottom: 8,
          paddingTop: 8,
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '本棚',
          tabBarIcon: ({ color }) => <Icon name="book" size={43} color={color} />,
        }}
      />
      <Tabs.Screen
        name="New"
        options={{
          title: '新刊',
          tabBarIcon: ({ color }) => <Icon name="fiber-new" size={43} color={color} />,
        }}
      />
      <Tabs.Screen
        name="Friends"
        options={{
          title: 'フレンド',
          tabBarIcon: ({ color }) => <Icon name="people" size={43} color={color} />,
        }}
      />
      <Tabs.Screen
        name="登録"
        options={{
          title: '登録',
          tabBarIcon: ({ color }) => <Icon name="barcode-scan" size={43} color={color} />,
        }}
      />
      <Tabs.Screen
        name="Settings"
        options={{
          title: '設定',
          tabBarIcon: ({ color }) => <Icon name="settings" size={43} color={color} />,
        }}
      />
    </Tabs>
  );
}
