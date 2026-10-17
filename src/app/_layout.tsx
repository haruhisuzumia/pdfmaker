import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider, Text } from 'react-native-paper';

import migrations from '../../drizzle/migrations';
import { db } from '@/db/client';
import { useSettings } from '@/store/settings';
import { darkTheme, lightTheme, navigationTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  const onboarded = useSettings((s) => s.onboarded);
  const themePreference = useSettings((s) => s.theme);
  const systemScheme = useColorScheme();

  const dark = themePreference === 'system' ? systemScheme === 'dark' : themePreference === 'dark';
  const theme = dark ? darkTheme : lightTheme;

  useEffect(() => {
    if (success || error) SplashScreen.hideAsync();
  }, [success, error]);

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text variant="titleMedium">Could not open your document list</Text>
        <Text variant="bodySmall">{error.message}</Text>
      </View>
    );
  }
  if (!success) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <PaperProvider theme={theme}>
        <ThemeProvider value={navigationTheme(theme)}>
          <StatusBar style={dark ? 'light' : 'dark'} />
          <Stack>
            <Stack.Protected guard={onboarded}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="doc/[id]/index" options={{ title: '' }} />
              <Stack.Screen
                name="doc/[id]/page"
                options={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: '#000' } }}
              />
              <Stack.Screen name="scan/review" options={{ title: 'Review scan' }} />
            </Stack.Protected>
            <Stack.Protected guard={!onboarded}>
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            </Stack.Protected>
          </Stack>
        </ThemeProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
});
