import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSettings } from '@/store/settings';
import { connectDrive } from '@/storage/drive/sync';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const SLIDES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'shield-lock-outline',
    title: 'Private by default',
    body: 'Your scans stay on your phone. No account needed, and nothing is uploaded unless you choose Google Drive.',
  },
  {
    icon: 'wifi-off',
    title: 'Works offline',
    body: 'Scanning, PDF tools and text recognition all run on your phone, even without internet.',
  },
  {
    icon: 'gift-outline',
    title: 'Free. No watermark. No ads.',
    body: 'Every feature is free, and your documents are never stamped with our logo.',
  },
];

export default function OnboardingScreen() {
  const theme = useTheme();
  const finish = () => useSettings.getState().set({ onboarded: true });
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;
  const [connecting, setConnecting] = useState(false);

  async function connectAndFinish() {
    setConnecting(true);
    try {
      await connectDrive();
    } catch {
      // Drive can be connected later in Settings.
    }
    finish();
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <View style={styles.top}>
        {!last && <Button onPress={finish}>Skip</Button>}
      </View>

      <View style={styles.body}>
        <View style={[styles.iconWrap, { backgroundColor: theme.colors.primaryContainer }]}>
          <MaterialCommunityIcons name={slide.icon} size={56} color={theme.colors.onPrimaryContainer} />
        </View>
        <Text variant="headlineMedium" style={styles.center}>
          {slide.title}
        </Text>
        <Text variant="bodyLarge" style={[styles.center, { color: theme.colors.onSurfaceVariant }]}>
          {slide.body}
        </Text>
      </View>

      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <View
            key={s.title}
            style={[styles.dot, { backgroundColor: i === index ? theme.colors.primary : theme.colors.outlineVariant }]}
          />
        ))}
      </View>

      <Button
        mode="contained"
        style={styles.cta}
        contentStyle={styles.ctaContent}
        disabled={connecting}
        onPress={last ? finish : () => setIndex(index + 1)}>
        {last ? 'Get started' : 'Next'}
      </Button>
      {last && (
        <Button icon="google-drive" style={styles.secondary} onPress={connectAndFinish} loading={connecting} disabled={connecting}>
          Also back up to Google Drive
        </Button>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24 },
  top: { height: 48, alignItems: 'flex-end' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  iconWrap: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  center: { textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cta: { borderRadius: 28 },
  ctaContent: { height: 52 },
  secondary: { marginTop: 8 },
});
