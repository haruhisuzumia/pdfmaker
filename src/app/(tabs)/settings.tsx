import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import Constants from 'expo-constants';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, List, Portal, SegmentedButtons, Snackbar, Switch, Text, useTheme } from 'react-native-paper';

import { allDocumentsQuery } from '@/db/documents';
import { useSettings, type PageSize, type SaveLocation, type ThemePreference } from '@/store/settings';
import { connectDrive, disconnectDrive, queueUpload } from '@/storage/drive/sync';

export default function SettingsScreen() {
  const theme = useTheme();
  const settings = useSettings();
  const { data: docs } = useLiveQuery(allDocumentsQuery());
  const phoneOnly = docs.filter((d) => d.syncState === 'local_only' && d.localUri);

  const [busy, setBusy] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const connected = settings.driveEmail != null;

  async function run(action: () => Promise<unknown>, done?: string) {
    setBusy(true);
    try {
      await action();
      if (done) setMessage(done);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <List.Section>
          <List.Subheader>Google Drive</List.Subheader>
          {connected ? (
            <>
              <List.Item
                title="Connected"
                description={settings.driveEmail}
                left={(p) => <List.Icon {...p} icon="google-drive" />}
              />
              <View style={styles.field}>
                <Text variant="bodyLarge">Save new documents to</Text>
                <SegmentedButtons
                  value={settings.saveLocation}
                  onValueChange={(v) => settings.set({ saveLocation: v as SaveLocation })}
                  buttons={[
                    { value: 'phone', label: 'Phone', icon: 'cellphone' },
                    { value: 'both', label: 'Phone + Drive', icon: 'cloud-outline' },
                  ]}
                />
              </View>
              <List.Item
                title="Upload only on Wi-Fi"
                description="Saves mobile data"
                left={(p) => <List.Icon {...p} icon="wifi" />}
                right={() => (
                  <Switch value={settings.wifiOnlyUploads} onValueChange={(v) => settings.set({ wifiOnlyUploads: v })} />
                )}
              />
              {phoneOnly.length > 0 && (
                <List.Item
                  title={`Back up ${phoneOnly.length} phone-only ${phoneOnly.length === 1 ? 'document' : 'documents'}`}
                  description="Copies them to the Panna folder in your Drive"
                  disabled={busy}
                  left={(p) => <List.Icon {...p} icon="cloud-upload-outline" />}
                  onPress={() =>
                    run(async () => {
                      for (const doc of phoneOnly) await queueUpload(doc);
                    }, 'Uploading in the background')
                  }
                />
              )}
              <List.Item
                title="Disconnect Google Drive"
                description="Files already on Drive stay there"
                titleStyle={{ color: theme.colors.error }}
                disabled={busy}
                left={(p) => <List.Icon {...p} icon="link-variant-off" color={theme.colors.error} />}
                onPress={() => setConfirmDisconnect(true)}
              />
            </>
          ) : (
            <List.Item
              title="Connect Google Drive"
              description="Back up documents to your own Drive. The app can only see files it creates."
              disabled={busy}
              left={(p) => <List.Icon {...p} icon="google-drive" />}
              onPress={() =>
                run(async () => {
                  const email = await connectDrive();
                  if (email) setMessage(`Connected as ${email}`);
                })
              }
            />
          )}
        </List.Section>

        <List.Section>
          <List.Subheader>Saving</List.Subheader>
          <List.Item
            title="Phone folder"
            description="Documents/Panna"
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
            title="Panna"
            description={`Version ${Constants.expoConfig?.version ?? ''} · Free, no ads, no watermark`}
            left={(p) => <List.Icon {...p} icon="information-outline" />}
          />
          <Text variant="bodySmall" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
            Your documents never leave your phone unless you connect Google Drive. The app has no ads and no tracking.
          </Text>
        </List.Section>
      </ScrollView>

      <Portal>
        <Dialog visible={confirmDisconnect} onDismiss={() => setConfirmDisconnect(false)}>
          <Dialog.Title>Disconnect Google Drive?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Documents that are only on Drive leave this list. Nothing is deleted from Drive or from your phone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmDisconnect(false)}>Cancel</Button>
            <Button
              textColor={theme.colors.error}
              onPress={() => {
                setConfirmDisconnect(false);
                run(disconnectDrive, 'Google Drive disconnected');
              }}>
              Disconnect
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar visible={message != null} onDismiss={() => setMessage(null)} duration={3000}>
        {message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: 32 },
  field: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  note: { paddingHorizontal: 16 },
});
