import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { documentByIdQuery } from '@/db/documents';
import { extractTitle } from '@/lib/pageRanges';
import { extractToNewDocument } from '@/storage/localStore';
import { ensurePages, type PageImage } from '@/storage/pageStore';

const COLUMNS = 3;
const PADDING = 12;
const GAP = 8;

export default function ExtractPagesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tileWidth = (width - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useLiveQuery(documentByIdQuery(id), [id]);
  const doc = data[0];

  const [pages, setPages] = useState<PageImage[] | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const docId = doc?.id;
  useEffect(() => {
    if (!doc) return;
    ensurePages(doc).then(setPages, (e: unknown) => setMessage(e instanceof Error ? e.message : 'Could not show the pages'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  if (!doc) return null;

  const sorted = [...selected].sort((a, b) => a - b);
  const title = customTitle ?? (sorted.length ? extractTitle(doc.title, sorted) : '');
  const allSelected = pages != null && selected.length === pages.length;

  const toggle = (index: number) =>
    setSelected((s) => (s.includes(index) ? s.filter((i) => i !== index) : [...s, index]));

  async function save() {
    setSaving(true);
    try {
      const newId = await extractToNewDocument(doc!, sorted, title.trim() || extractTitle(doc!.title, sorted));
      router.replace({ pathname: '/doc/[id]', params: { id: newId } });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not create the new document');
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={pages ?? []}
        numColumns={COLUMNS}
        keyExtractor={(p) => p.uri}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Tap the pages to copy into a new PDF. “{doc.title}” stays unchanged.
            </Text>
            <Button
              mode="text"
              compact
              style={styles.selectAll}
              onPress={() => setSelected(allSelected || !pages ? [] : pages.map((_, i) => i))}>
              {allSelected ? 'Clear selection' : 'Select all'}
            </Button>
            {!pages && <ActivityIndicator style={styles.loading} />}
          </View>
        }
        renderItem={({ item, index }) => {
          const on = selected.includes(index);
          return (
            <Pressable
              onPress={() => toggle(index)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`Page ${index + 1}`}
              style={[
                styles.tile,
                {
                  width: tileWidth,
                  aspectRatio: item.width / item.height,
                  borderColor: on ? theme.colors.primary : 'transparent',
                },
              ]}>
              <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={item.uri} />
              <View style={[styles.badge, { backgroundColor: on ? theme.colors.primary : 'rgba(0,0,0,0.5)' }]}>
                {on ? (
                  <MaterialCommunityIcons name="check" size={14} color={theme.colors.onPrimary} />
                ) : (
                  <Text variant="labelSmall" style={styles.badgeText}>
                    {index + 1}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        }}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.elevation.level2 }]}>
        {selected.length > 0 && (
          <TextInput mode="outlined" dense label="New document name" value={title} onChangeText={setCustomTitle} disabled={saving} />
        )}
        <Button mode="contained" icon="file-export-outline" onPress={save} loading={saving} disabled={saving || selected.length === 0}>
          {selected.length === 0
            ? 'Select pages'
            : `Save ${selected.length} ${selected.length === 1 ? 'page' : 'pages'} as new PDF`}
        </Button>
      </View>

      <Snackbar visible={message != null} onDismiss={() => setMessage(null)} duration={4000}>
        {message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: PADDING, gap: GAP },
  header: { paddingHorizontal: 4, gap: 4, marginBottom: 4 },
  selectAll: { alignSelf: 'flex-start' },
  loading: { marginTop: 32 },
  gridRow: { gap: GAP },
  tile: { borderRadius: 8, borderWidth: 3, overflow: 'hidden' },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff' },
  footer: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
});
