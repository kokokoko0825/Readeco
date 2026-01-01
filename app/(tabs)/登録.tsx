import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RegisterScreen() {
  const colorScheme = useColorScheme();

  const handleBarcodeScan = () => {
    router.push('/(modals)/barcode-scanner');
  };

  const handleExternalImport = () => {
    // TODO: 外部データインポート機能を実装
    console.log('外部データをインポート');
  };

  const handleManualImport = () => {
    router.push('/(modals)/manual-book-entry');
  };

  const menuItems = [
    {
      id: 'barcode',
      icon: (
        <Icon
          name="barcode-scan"
          size={24}
          color={Colors[colorScheme ?? 'light'].text}
        />
      ),
      text: 'バーコードを読み込む',
      onPress: handleBarcodeScan,
    },
    {
      id: 'external',
      icon: (
        <Icon
          name="download"
          size={24}
          color={Colors[colorScheme ?? 'light'].text}
        />
      ),
      text: '外部データをインポート',
      onPress: handleExternalImport,
    },
    {
      id: 'manual',
      icon: (
        <Icon
          name="edit"
          size={24}
          color={Colors[colorScheme ?? 'light'].text}
        />
      ),
      text: '手動でデータをインポート',
      onPress: handleManualImport,
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

