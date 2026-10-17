import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Button, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { docSubtitle } from '@/components/DocRow';
import { allDocumentsQuery } from '@/db/documents';
import { defaultScanTitle, isOnPhone } from '@/lib/documents';
import { mergeDocuments } from '@/storage/localStore';

export default function MergeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: docs } = useLiveQuery(allDocumentsQuery());
  const candidates = useMemo(() => docs.filter((d) => d.kind === 'pdf' && isOnPhone(d)), [docs]);

  // Tick order is merge order.
  const [order, setOrder] = useState<string[]>([]);
  const [title, setTitle] = useState(() => defaultScanTitle(new Date(), 'Merged'));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const toggle = (id: string) => setOrder((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const totalPages = order.reduce((n, id) => n + (candidates.find((d) => d.id === id)?.pageCount ?? 0), 0);

  async function merge() {
    setSaving(true);
    try {
      const chosen = order.map((id) => candidates.find((d) => d.id === id)).filter((d) => d != null);
      const id = await mergeDocuments(chosen, title.trim() || defaultScanTitle(new Date(), 'Merged'));
      router.replace({ pathname: '/doc/[id]', params: { id } });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not merge the documents');
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={candidates}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <Text variant="bodyMedium" style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
            Tap documents in the order you want them. The originals stay unchanged.
          </Text>
        }
        ListEmptyComponent={
          <Text variant="bodyMedium" style={styles.hint}>
            You need at least two PDFs on this phone to merge.
          </Text>
        }
        renderItem={({ item }) => {
          const position = order.indexOf(item.id);
          const on = position >= 0;
          return (
            <Pressable
              onPress={() => toggle(item.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={[styles.row, on && { backgroundColor: theme.colors.secondaryContainer }]}>
              <View
                style={[
                  styles.number,
                  on
                    ? { backgroundColor: theme.colors.primary }
                    : { borderWidth: 2, borderColor: theme.colors.outline },
                ]}>
                {on && (
                  <Text variant="labelLarge" style={{ color: theme.colors.onPrimary }}>
                    {position + 1}
                  </Text>
                )}
              </View>
              <View style={styles.rowText}>
                <Text variant="titleSmall" numberOfLines={1}>
                  {item.title}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {docSubtitle(item)}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.elevation.level2 }]}>
        {order.length >= 2 && (
          <TextInput mode="outlined" dense label="New document name" value={title} onChangeText={setTitle} disabled={saving} />
        )}
        <Button mode="contained" icon="file-multiple-outline" onPress={merge} loading={saving} disabled={saving || order.length < 2}>
          {order.length < 2
            ? 'Choose at least 2 documents'
            : `Merge ${order.length} documents${totalPages ? ` · ${totalPages} pages` : ''}`}
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
  content: { paddingVertical: 8 },
  hint: { paddingHorizontal: 16, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12 },
  number: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  footer: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
});
