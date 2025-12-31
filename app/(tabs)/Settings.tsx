import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();

  const handleAccountSettings = () => {
    // TODO: アカウント設定画面に遷移
    console.log('アカウント設定');
  };

  const handleNotificationSettings = () => {
    // TODO: 通知設定画面に遷移
    console.log('通知設定');
  };

  const handleAbout = () => {
    // TODO: アプリについて画面に遷移
    console.log('アプリについて');
  };

  const menuItems = [
    {
      id: 'account',
      icon: (
        <MaterialIcons
          name="account-circle"
          size={24}
          color={Colors[colorScheme ?? 'light'].text}
        />
      ),
      text: 'アカウント設定',
      onPress: handleAccountSettings,
    },
    {
      id: 'notification',
      icon: (
        <MaterialIcons
          name="notifications"
          size={24}
          color={Colors[colorScheme ?? 'light'].text}
        />
      ),
      text: '通知設定',
      onPress: handleNotificationSettings,
    },
    {
      id: 'about',
      icon: (
        <MaterialIcons
          name="info"
          size={24}
          color={Colors[colorScheme ?? 'light'].text}
        />
      ),
      text: 'アプリについて',
      onPress: handleAbout,
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <View key={item.id}>
            <Pressable
              style={({ pressed }) => [
                styles.menuItem,
                pressed && styles.menuItemPressed,
              ]}
              onPress={item.onPress}>
              <View style={styles.menuItemContent}>
                <View style={styles.iconContainer}>{item.icon}</View>
                <ThemedText style={styles.menuItemText}>{item.text}</ThemedText>
              </View>
            </Pressable>
            {index < menuItems.length - 1 && <View style={styles.itemDivider} />}
          </View>
        ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  menuContainer: {
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  menuItem: {
    paddingVertical: 16,
  },
  menuItemPressed: {
    opacity: 0.6,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 16,
    width: 24,
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    flex: 1,
  },
  itemDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
  },
});

