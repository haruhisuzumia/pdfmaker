import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ProgressBar, Snackbar, Text, useTheme } from 'react-native-paper';

import { DocRow } from '@/components/DocRow';
import { allDocumentsQuery } from '@/db/documents';
import type { Doc } from '@/db/schema';
import { isOnPhone } from '@/lib/documents';
import { exportPagesAsImages } from '@/storage/localStore';

type Action = 'split' | 'images' | 'compress' | 'text' | 'sign';

const COPY: Record<Action, { title: string; hint: string }> = {
  split: { title: 'Split PDF', hint: 'Choose a document, then pick the pages to copy into a new PDF.' },
  compress: { title: 'Compress to size', hint: 'Choose a document to make smaller, for example under 100 KB.' },
  text: { title: 'Extract text', hint: 'Choose a document to read its text (English or Hindi).' },
  sign: { title: 'Sign a PDF', hint: 'Choose a document to sign.' },
  images: { title: 'PDF to images', hint: 'Choose a document. Each page is saved as a JPG in Pictures/PDF Maker.' },
};

/** Picks one document for a tool that works on a single PDF. */
export default function ChooseDocumentScreen() {
  const theme = useTheme();
  const { action = 'split' } = useLocalSearchParams<{ action?: Action }>();
  const { data: docs } = useLiveQuery(allDocumentsQuery());
  const candidates = useMemo(() => docs.filter((d) => d.kind === 'pdf' && isOnPhone(d)), [docs]);

  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function choose(doc: Doc) {
    if (action !== 'images') {
      const pathname = (
        {
          split: '/doc/[id]/extract',
          compress: '/doc/[id]/compress',
          text: '/doc/[id]/text',
          sign: '/doc/[id]/sign',
        } as const
      )[action];
      router.replace({ pathname, params: { id: doc.id } });
      return;
    }
    if (progress != null) return;
    setProgress(0);
    try {
      const count = await exportPagesAsImages(doc, (done, total) => setProgress(total ? done / total : 0));
      setMessage(`${count} ${count === 1 ? 'image' : 'images'} saved to Pictures/PDF Maker`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save the images');
    } finally {
      setProgress(null);
    }
  }

  const copy = COPY[action] ?? COPY.split;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: copy.title }} />
      {progress != null && <ProgressBar progress={progress} />}
      <FlatList
        data={candidates}
        keyExtractor={(d) => d.id}
        ListHeaderComponent={
          <Text variant="bodyMedium" style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
            {copy.hint}
          </Text>
        }
        ListEmptyComponent={
          <Text variant="bodyMedium" style={styles.hint}>
            No PDFs on this phone yet.
          </Text>
        }
        renderItem={({ item }) => <DocRow doc={item} onPress={choose} />}
      />
      <Snackbar visible={message != null} onDismiss={() => setMessage(null)} duration={4000}>
        {message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hint: { paddingHorizontal: 16, paddingVertical: 12 },
});
