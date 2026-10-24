import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Chip, FAB, IconButton, Menu, Searchbar, Snackbar, Text, useTheme } from 'react-native-paper';

import { DocRow } from '@/components/DocRow';
import { NewDocumentSheet, type NewDocumentAction } from '@/components/NewDocumentSheet';
import { allDocumentsQuery } from '@/db/documents';
import { filterDocs, sortDocs, type LocationFilter, type SortKey } from '@/lib/documents';
import { scanIdCard, startNewDocument } from '@/scan/flows';
import { useSettings } from '@/store/settings';
import { syncNow } from '@/storage/drive/sync';
import { importPdfs } from '@/storage/localStore';

const FILTERS: { key: LocationFilter; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'file-document-multiple-outline' },
  { key: 'phone', label: 'Phone', icon: 'cellphone' },
  { key: 'drive', label: 'Drive', icon: 'cloud-outline' },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'date', label: 'Newest first' },
  { key: 'name', label: 'Name' },
  { key: 'size', label: 'Largest first' },
];

export default function DocumentsScreen() {
  const theme = useTheme();
  const { data: docs } = useLiveQuery(allDocumentsQuery());

  const [search, setSearch] = useState('');
  const [location, setLocation] = useState<LocationFilter>('all');
  const [sort, setSort] = useState<SortKey>('date');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const driveConnected = useSettings((s) => s.driveEmail != null);

  async function refresh() {
    setRefreshing(true);
    await syncNow();
    setRefreshing(false);
  }

  const visible = useMemo(() => sortDocs(filterDocs(docs, location, search), sort), [docs, location, search, sort]);

  async function handleNew(action: NewDocumentAction) {
    setSheetOpen(false);
    setBusy(true);
    try {
      if (action === 'scan' || action === 'photos') {
        await startNewDocument(action);
      } else if (action === 'id-card') {
        await scanIdCard();
      } else if (action === 'pdf') {
        const count = await importPdfs();
        if (count > 0) setMessage(count === 1 ? 'PDF imported' : `${count} PDFs imported`);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const isEmpty = docs.length === 0;

  return (
    <View style={styles.screen}>
      {!isEmpty && (
        <View style={styles.controls}>
          <Searchbar placeholder="Search documents" value={search} onChangeText={setSearch} mode="bar" style={styles.search} />
          <View style={styles.chips}>
            {FILTERS.map((f) => (
              <Chip
                key={f.key}
                icon={f.icon}
                selected={location === f.key}
                showSelectedOverlay
                onPress={() => setLocation(f.key)}>
                {f.label}
              </Chip>
            ))}
            <View style={styles.spacer} />
            <Menu
              visible={sortMenuOpen}
              onDismiss={() => setSortMenuOpen(false)}
              anchor={<IconButton icon="sort" accessibilityLabel="Sort" onPress={() => setSortMenuOpen(true)} />}>
              {SORTS.map((s) => (
                <Menu.Item
                  key={s.key}
                  title={s.label}
                  leadingIcon={sort === s.key ? 'check' : undefined}
                  onPress={() => {
                    setSort(s.key);
                    setSortMenuOpen(false);
                  }}
                />
              ))}
            </Menu>
          </View>
        </View>
      )}

      {isEmpty ? (
        <View style={styles.empty}>
          <Text variant="headlineSmall">No documents yet</Text>
          <Text variant="bodyMedium" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
            Scan a paper document or import a PDF. Everything stays on your phone unless you connect Google Drive.
          </Text>
          <Button mode="contained" icon="plus" onPress={() => setSheetOpen(true)}>
            Add your first document
          </Button>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(d) => d.id}
          renderItem={({ item }) => (
            <DocRow doc={item} onPress={(d) => router.push({ pathname: '/doc/[id]', params: { id: d.id } })} />
          )}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={driveConnected ? refresh : undefined}
          ListEmptyComponent={
            <Text style={[styles.noMatch, { color: theme.colors.onSurfaceVariant }]}>No documents match your search.</Text>
          }
        />
      )}

      <FAB icon="plus" label="New" style={styles.fab} loading={busy} disabled={busy} onPress={() => setSheetOpen(true)} />
      <NewDocumentSheet visible={sheetOpen} onDismiss={() => setSheetOpen(false)} onSelect={handleNew} />
      <Snackbar visible={message != null} onDismiss={() => setMessage(null)} duration={3000}>
        {message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  controls: { paddingHorizontal: 16, paddingTop: 4, gap: 8 },
  search: { elevation: 0 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spacer: { flex: 1 },
  listContent: { paddingBottom: 96 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyText: { textAlign: 'center', marginBottom: 8 },
  noMatch: { textAlign: 'center', padding: 32 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
