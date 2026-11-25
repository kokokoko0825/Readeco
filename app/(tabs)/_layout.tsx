import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { Icon } from '@/components/Icon';
import { NotificationIcon } from '@/components/NotificationIcon';
import { Colors } from '@/constants/theme';
import { useReleaseNotes } from '@/contexts/ReleaseNotesContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { hasNewReleases } = useReleaseNotes();

  const isDark = colorScheme === 'dark';
  const headerStyle = {
    backgroundColor: Colors[colorScheme ?? 'light'].background,
    borderBottomWidth: 1,
    borderBottomColor: Colors[colorScheme ?? 'light'].accent,
  };

  const headerTitleStyle = {
    fontWeight: 'bold' as const,
    textAlign: 'center' as const,
    alignSelf: 'center' as const,
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: isDark ? '#F5F0E6' : '#FCFAF2',
        tabBarInactiveTintColor: isDark ? '#A89B8C' : '#C4A77D',
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
          backgroundColor: Colors[colorScheme ?? 'light'].tabBarBackground,
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
          tabBarAccessibilityLabel: hasNewReleases ? '設定、新しいリリースノートがあります' : '設定',
          tabBarIcon: ({ color }) => (
            <NotificationIcon
              name="settings"
              size={43}
              color={color}
              showDot={hasNewReleases}
              surfaceColor={Colors[colorScheme ?? 'light'].tabBarBackground}
            />
          ),
        }}
      />
    </Tabs>
  );
}
