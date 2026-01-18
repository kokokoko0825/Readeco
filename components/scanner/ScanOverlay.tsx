/**
 * スキャン領域オーバーレイコンポーネント
 * カメラビューの上にスキャン領域を表示
 */

import { Dimensions, StyleSheet, View } from 'react-native';

interface ScanOverlayProps {
  visible: boolean;
}

const SCAN_AREA_WIDTH = 280;
const SCAN_AREA_HEIGHT = 140;
const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;

export function ScanOverlay({ visible }: ScanOverlayProps) {
  if (!visible) return null;

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const maskSideWidth = (screenWidth - SCAN_AREA_WIDTH) / 2;
  const maskVerticalHeight = (screenHeight - SCAN_AREA_HEIGHT) / 2;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* 上部マスク */}
      <View style={[styles.mask, { height: maskVerticalHeight }]} />

      {/* 中央行 */}
      <View style={styles.centerRow}>
        {/* 左側マスク */}
        <View style={[styles.mask, { width: maskSideWidth, height: SCAN_AREA_HEIGHT }]} />

        {/* スキャン領域 */}
        <View style={styles.scanArea}>
          {/* 四隅のコーナーマーカー */}
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>

        {/* 右側マスク */}
        <View style={[styles.mask, { width: maskSideWidth, height: SCAN_AREA_HEIGHT }]} />
      </View>

      {/* 下部マスク */}
      <View style={[styles.mask, { flex: 1 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  mask: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  centerRow: {
    flexDirection: 'row',
    height: SCAN_AREA_HEIGHT,
  },
  scanArea: {
    width: SCAN_AREA_WIDTH,
    height: SCAN_AREA_HEIGHT,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: '#fff',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
  },
});
