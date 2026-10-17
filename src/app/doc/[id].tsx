import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, List, Portal, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';

import { docSubtitle } from '@/components/DocRow';
import { LocationBadge } from '@/components/LocationBadge';
import { documentByIdQuery } from '@/db/documents';
import { badgeFor, isOnPhone } from '@/lib/documents';
import { deleteFromPhone, renameDocument, shareDocument } from '@/storage/localStore';

export default function DocumentScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useLiveQuery(documentByIdQuery(id), [id]);
  const doc = data[0];

  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!doc) return null;

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Something went wrong');
    }
  }

  async function handleDelete() {
    setConfirmDelete(false);
    // The row disappears from the live query, so leave the screen before it unmounts.
    router.back();
    await run(() => deleteFromPhone(doc));
  }

  return (
    <>
      <Stack.Screen options={{ title: doc.title }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.preview, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Page viewer arrives in the next update
          </Text>
        </View>

        <View style={styles.meta}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {docSubtitle(doc)}
          </Text>
          <LocationBadge badge={badgeFor(doc.syncState)} />
        </View>

        <View style={styles.actions}>
          <Button mode="contained" icon="share-variant" disabled={!isOnPhone(doc)} onPress={() => run(() => shareDocument(doc))}>
            Share
          </Button>
        </View>

        <List.Section>
          <List.Item
            title="Rename"
            left={(p) => <List.Icon {...p} icon="pencil-outline" />}
            onPress={() => {
              setDraftTitle(doc.title);
              setRenaming(true);
            }}
          />
          <List.Item
            title="Delete"
            titleStyle={{ color: theme.colors.error }}
            left={(p) => <List.Icon {...p} icon="delete-outline" color={theme.colors.error} />}
            onPress={() => setConfirmDelete(true)}
          />
        </List.Section>
      </ScrollView>

      <Portal>
        <Dialog visible={renaming} onDismiss={() => setRenaming(false)}>
          <Dialog.Title>Rename</Dialog.Title>
          <Dialog.Content>
            <TextInput mode="outlined" value={draftTitle} onChangeText={setDraftTitle} autoFocus selectTextOnFocus />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRenaming(false)}>Cancel</Button>
            <Button
              onPress={() => {
                setRenaming(false);
                run(() => renameDocument(doc, draftTitle));
              }}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={confirmDelete} onDismiss={() => setConfirmDelete(false)}>
          <Dialog.Title>Delete document?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">“{doc.title}” will be deleted from your phone.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmDelete(false)}>Cancel</Button>
            <Button textColor={theme.colors.error} onPress={handleDelete}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={message != null} onDismiss={() => setMessage(null)} duration={4000}>
        {message}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  preview: { height: 280, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: 8 },
});
