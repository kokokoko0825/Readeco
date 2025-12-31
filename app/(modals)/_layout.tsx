import { Stack } from 'expo-router';

export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        presentation: 'modal',
        headerShown: false,
      }}>
      <Stack.Screen name="barcode-scanner" />
      <Stack.Screen name="manual-book-entry" />
    </Stack>
  );
}


