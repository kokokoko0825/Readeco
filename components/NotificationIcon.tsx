import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface NotificationIconProps {
  name: IconName;
  size: number;
  color: string;
  showDot: boolean;
  surfaceColor: string;
  style?: StyleProp<ViewStyle>;
}

export function NotificationIcon({ name, size, color, showDot, surfaceColor, style }: NotificationIconProps) {
  const colors = Colors[useColorScheme() ?? 'light'];

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Icon name={name} size={size} color={color} />
      {showDot && (
        <View
          pointerEvents="none"
          accessible={false}
          style={[styles.dot, { backgroundColor: colors.accent, borderColor: surfaceColor }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { position: 'absolute', top: -1, right: -1, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
});
