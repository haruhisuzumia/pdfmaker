import Constants from 'expo-constants';
import { ScrollView, StyleSheet, View } from 'react-native';
import { List, SegmentedButtons, Switch, Text, useTheme } from 'react-native-paper';

import { useSettings, type PageSize, type ThemePreference } from '@/store/settings';

export default function SettingsScreen() {
  const theme = useTheme();
  const settings = useSettings();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <List.Section>
        <List.Subheader>Saving</List.Subheader>
        <List.Item
          title="Default save location"
          description="Phone · Google Drive arrives in a later update"
          left={(p) => <List.Icon {...p} icon="content-save-outline" />}
        />
        <List.Item
          title="Phone folder"
          description="Documents/PDF Maker"
          left={(p) => <List.Icon {...p} icon="folder-outline" />}
        />
        <View style={styles.field}>
          <Text variant="bodyLarge">Default page size</Text>
          <SegmentedButtons
            value={settings.pageSize}
            onValueChange={(v) => settings.set({ pageSize: v as PageSize })}
            buttons={[
              { value: 'a4', label: 'A4' },
              { value: 'letter', label: 'Letter' },
              { value: 'fit', label: 'Fit image' },
            ]}
          />
        </View>
      </List.Section>

      <List.Section>
        <List.Subheader>Google Drive</List.Subheader>
        <List.Item
          title="Connect Google Drive"
          description="Coming soon. The app will only see files it creates."
          disabled
          left={(p) => <List.Icon {...p} icon="google-drive" />}
        />
        <List.Item
          title="Upload only on Wi-Fi"
          disabled
          left={(p) => <List.Icon {...p} icon="wifi" />}
          right={() => (
            <Switch value={settings.wifiOnlyUploads} onValueChange={(v) => settings.set({ wifiOnlyUploads: v })} disabled />
          )}
        />
      </List.Section>

      <List.Section>
        <List.Subheader>Appearance</List.Subheader>
        <View style={styles.field}>
          <Text variant="bodyLarge">Theme</Text>
          <SegmentedButtons
            value={settings.theme}
            onValueChange={(v) => settings.set({ theme: v as ThemePreference })}
            buttons={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </View>
      </List.Section>

      <List.Section>
        <List.Subheader>About</List.Subheader>
        <List.Item
          title="PDF Maker"
          description={`Version ${Constants.expoConfig?.version ?? ''} · Free, no ads, no watermark`}
          left={(p) => <List.Icon {...p} icon="information-outline" />}
        />
        <Text variant="bodySmall" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
          Your documents never leave your phone unless you connect Google Drive. The app has no ads and no tracking.
        </Text>
      </List.Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  field: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  note: { paddingHorizontal: 16 },
});
