import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, List, Portal, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';

import { docSubtitle } from '@/components/DocRow';
import { LocationBadge } from '@/components/LocationBadge';
import { documentByIdQuery } from '@/db/documents';
import { badgeFor, isOnPhone } from '@/lib/documents';
import type { DraftPage } from '@/lib/draftPages';
import { useDraft } from '@/store/draft';
import { deleteFromPhone, exportPagesAsImages, renameDocument, shareDocument } from '@/storage/localStore';
import { ensurePages, type PageImage } from '@/storage/pageStore';

// Tools that act on a document and arrive in a later milestone.
const COMING_SOON = [{ label: 'Sign', icon: 'draw' }];

export default function DocumentScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useLiveQuery(documentByIdQuery(id), [id]);
  const doc = data[0];

  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pages, setPages] = useState<PageImage[] | null>(null);
  const [pagesError, setPagesError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);

  const docId = doc?.id;
  const localUri = doc?.localUri;
  const updatedAt = doc?.updatedAt;
  useEffect(() => {
    if (!doc) return;
    let active = true;
    ensurePages(doc).then(
      (result) => active && setPages(result),
      (e: unknown) => active && setPagesError(e instanceof Error ? e.message : 'Could not show the pages'),
    );
    return () => {
      active = false;
    };
    // Reload pages when the file changes (edit, replace), not on every row update such as a rename.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, localUri, updatedAt]);

  if (!doc) return null;

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Something went wrong');
    }
  }

  function editPages() {
    if (!pages || !doc) return;
    const draft: DraftPage[] = pages.map((p, index) => ({
      id: `${doc.id}-${index}`,
      uri: p.uri,
      rotation: 0,
      source: { kind: 'pdf', index },
    }));
    useDraft.getState().startEdit(doc.id, draft);
    router.push('/scan/review');
  }

  async function saveAsImages() {
    if (!doc) return;
    setExporting(true);
    setMessage('Saving pages to your Gallery…');
    try {
      const count = await exportPagesAsImages(doc);
      setMessage(`${count} ${count === 1 ? 'image' : 'images'} saved to Pictures/PDF Maker`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save the images');
    } finally {
      setExporting(false);
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
      <FlatList
        data={pages ?? []}
        keyExtractor={(p) => p.uri}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
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
              <Chip icon="file-document-edit-outline" disabled={!pages} onPress={editPages} compact>
                Edit pages
              </Chip>
              <Chip
                icon="file-export-outline"
                disabled={!pages || !isOnPhone(doc)}
                onPress={() => router.push({ pathname: '/doc/[id]/extract', params: { id: doc.id } })}
                compact>
                Extract pages
              </Chip>
              <Chip icon="image-multiple-outline" disabled={!isOnPhone(doc) || exporting} onPress={saveAsImages} compact>
                Save as images
              </Chip>
              <Chip
                icon="arrow-collapse-vertical"
                disabled={!isOnPhone(doc)}
                onPress={() => router.push({ pathname: '/doc/[id]/compress', params: { id: doc.id } })}
                compact>
                Compress
              </Chip>
              <Chip
                icon="text-recognition"
                disabled={!pages}
                onPress={() => router.push({ pathname: '/doc/[id]/text', params: { id: doc.id } })}
                compact>
                Extract text
              </Chip>
              {COMING_SOON.map((tool) => (
                <Chip key={tool.label} icon={tool.icon} disabled compact>
                  {tool.label}
                </Chip>
              ))}
            </View>
            {!pages && !pagesError && <ActivityIndicator style={styles.loading} />}
            {pagesError && (
              <Text variant="bodyMedium" style={[styles.pagesError, { color: theme.colors.onSurfaceVariant }]}>
                {pagesError}
              </Text>
            )}
          </View>
        }
        renderItem={({ item, index }) => (
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel={`Page ${index + 1}, open full screen`}
            onPress={() => router.push({ pathname: '/doc/[id]/page', params: { id: doc.id, index: String(index) } })}
            style={[styles.page, { backgroundColor: theme.colors.surfaceVariant, aspectRatio: item.width / item.height }]}>
            <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="contain" recyclingKey={item.uri} />
          </Pressable>
        )}
        ListFooterComponent={
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
        }
      />

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
  content: { padding: 16, gap: 12 },
  header: { gap: 12, marginBottom: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  loading: { marginTop: 32 },
  pagesError: { textAlign: 'center', marginTop: 24 },
  page: { width: '100%', borderRadius: 8, overflow: 'hidden' },
});
