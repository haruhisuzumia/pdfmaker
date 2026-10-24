import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, usePreventRemove } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Dialog, IconButton, Menu, Portal, SegmentedButtons, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';
import ReorderableList, { useReorderableDrag, type ReorderableListReorderEvent } from 'react-native-reorderable-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { documentByIdQuery } from '@/db/documents';
import { defaultScanTitle } from '@/lib/documents';
import type { DraftPage } from '@/lib/draftPages';
import { clearDraftFiles, pickImages, scanPages } from '@/scan/scanner';
import { useDraft } from '@/store/draft';
import { useSettings, type PageSize } from '@/store/settings';
import { saveEditedDocument, saveScannedDocument } from '@/storage/localStore';

function PageRow({ page, index }: { page: DraftPage; index: number }) {
  const theme = useTheme();
  const drag = useReorderableDrag();
  const rotate = useDraft((s) => s.rotate);
  const remove = useDraft((s) => s.remove);

  return (
    <Pressable onLongPress={drag} delayLongPress={200} style={[styles.row, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.thumbBox, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Image source={{ uri: page.uri }} style={[styles.thumb, { transform: [{ rotate: `${page.rotation}deg` }] }]} contentFit="contain" />
      </View>
      <Text variant="titleSmall" style={styles.rowLabel}>
        Page {index + 1}
      </Text>
      <IconButton icon="rotate-right" accessibilityLabel={`Rotate page ${index + 1}`} onPress={() => rotate(page.id)} />
      <IconButton icon="delete-outline" accessibilityLabel={`Remove page ${index + 1}`} onPress={() => remove(page.id)} />
      <Pressable onPressIn={drag} accessibilityLabel={`Drag page ${index + 1}`} hitSlop={8}>
        <MaterialCommunityIcons name="drag-horizontal-variant" size={24} color={theme.colors.onSurfaceVariant} />
      </Pressable>
    </Pressable>
  );
}

export default function ReviewScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pages = useDraft((s) => s.pages);
  const target = useDraft((s) => s.target);
  const { append, move, clear } = useDraft.getState();
  const defaultPageSize = useSettings((s) => s.pageSize);
  const editingId = target.mode === 'edit' ? target.docId : '';
  const { data: editing } = useLiveQuery(documentByIdQuery(editingId), [editingId]);
  const editDoc = target.mode === 'edit' ? editing[0] : undefined;

  const [title, setTitle] = useState(() => defaultScanTitle());
  const [pageSize, setPageSize] = useState<PageSize>(defaultPageSize);
  const [progress, setProgress] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState<(() => void) | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const saving = progress != null;

  // While saving, back is simply ignored so the draft files stay until the PDF is written.
  usePreventRemove(pages.length > 0 && !savedId, ({ repeat }) => {
    if (!saving) setConfirmLeave(() => repeat);
  });

  useEffect(() => {
    if (!savedId) return;
    // An edit saved in place returns to the viewer; anything else opens the new document.
    if (savedId === editingId) router.back();
    else router.replace({ pathname: '/doc/[id]', params: { id: savedId } });
    clear();
  }, [savedId, editingId, clear]);

  async function addPages(from: 'scan' | 'photos') {
    setAddMenuOpen(false);
    try {
      const more = from === 'scan' ? await scanPages() : await pickImages();
      if (more) append(more);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not add pages');
    }
  }

  async function save() {
    setProgress('Preparing…');
    const onProgress = (done: number, total: number) =>
      setProgress(done < total ? `Saving page ${done + 1} of ${total}…` : 'Finishing…');
    try {
      const id = editDoc
        ? await saveEditedDocument(editDoc, pages, { pageSize: defaultPageSize, onProgress })
        : await saveScannedDocument(pages, { title, pageSize, onProgress });
      setSavedId(id);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save the document');
      setProgress(null);
    }
  }

  function discard() {
    const leave = confirmLeave;
    setConfirmLeave(null);
    clearDraftFiles();
    clear();
    leave?.();
  }

  const header = editDoc ? (
    <View style={styles.header}>
      <Text variant="titleMedium" numberOfLines={1}>
        {editDoc.title}
      </Text>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        Long-press a page or use the handle to change the order. Changes replace the file in Documents/Panna.
      </Text>
    </View>
  ) : (
    <View style={styles.header}>
      <TextInput mode="outlined" label="Name" value={title} onChangeText={setTitle} disabled={saving} />
      <View style={styles.field}>
        <Text variant="labelLarge">Page size</Text>
        <SegmentedButtons
          value={pageSize}
          onValueChange={(v) => setPageSize(v as PageSize)}
          buttons={[
            { value: 'a4', label: 'A4', disabled: saving },
            { value: 'letter', label: 'Letter', disabled: saving },
            { value: 'fit', label: 'Fit image', disabled: saving },
          ]}
        />
      </View>
      <View style={styles.saveTo}>
        <MaterialCommunityIcons name="cellphone" size={18} color={theme.colors.onSurfaceVariant} />
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          Saves to Documents/Panna on this phone
        </Text>
      </View>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        Long-press a page or use the handle to change the order.
      </Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      {editDoc && <Stack.Screen options={{ title: 'Edit pages' }} />}
      {pages.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="titleMedium">No pages</Text>
          <Button mode="contained" icon="camera-outline" onPress={() => addPages('scan')}>
            Scan pages
          </Button>
          <Button mode="outlined" icon="image-multiple-outline" onPress={() => addPages('photos')}>
            Choose photos
          </Button>
        </View>
      ) : (
        <ReorderableList
          data={pages}
          keyExtractor={(p) => p.id}
          renderItem={({ item, index }) => <PageRow page={item} index={index} />}
          onReorder={({ from, to }: ReorderableListReorderEvent) => move(from, to)}
          dragEnabled={!saving}
          ListHeaderComponent={header}
          ListFooterComponent={
            <Menu
              visible={addMenuOpen}
              onDismiss={() => setAddMenuOpen(false)}
              anchor={
                <Button icon="plus" mode="outlined" style={styles.addButton} onPress={() => setAddMenuOpen(true)} disabled={saving}>
                  Add pages
                </Button>
              }>
              <Menu.Item leadingIcon="camera-outline" title="Scan" onPress={() => addPages('scan')} />
              <Menu.Item leadingIcon="image-multiple-outline" title="From photos" onPress={() => addPages('photos')} />
            </Menu>
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.elevation.level2 }]}>
        {saving && (
          <Text variant="bodySmall" style={styles.progress}>
            {progress}
          </Text>
        )}
        <Button
          mode="contained"
          icon={editDoc ? 'content-save-outline' : 'file-pdf-box'}
          onPress={save}
          loading={saving}
          disabled={saving || pages.length === 0 || (target.mode === 'edit' && !editDoc)}
          contentStyle={styles.saveContent}>
          {editDoc ? 'Save changes' : 'Save as PDF'} · {pages.length} {pages.length === 1 ? 'page' : 'pages'}
        </Button>
      </View>

      <Portal>
        <Dialog visible={confirmLeave != null} onDismiss={() => setConfirmLeave(null)}>
          <Dialog.Title>{editDoc ? 'Discard changes?' : 'Discard this scan?'}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{editDoc ? 'The document stays as it was.' : 'The scanned pages haven’t been saved.'}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmLeave(null)}>Keep editing</Button>
            <Button textColor={theme.colors.error} onPress={discard}>
              Discard
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={message != null} onDismiss={() => setMessage(null)} duration={5000}>
        {message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { padding: 16, gap: 12 },
  field: { gap: 6 },
  saveTo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  listContent: { paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, gap: 4 },
  thumbBox: { width: 64, height: 84, borderRadius: 6, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 64, height: 84 },
  rowLabel: { flex: 1, marginLeft: 12 },
  addButton: { marginHorizontal: 16, marginTop: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  footer: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  progress: { textAlign: 'center' },
  saveContent: { height: 48 },
});
