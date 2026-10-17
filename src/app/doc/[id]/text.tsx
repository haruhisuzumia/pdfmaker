import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Divider, ProgressBar, SegmentedButtons, Snackbar, Text, useTheme } from 'react-native-paper';

import TextRecognition, { type Script } from '@modules/text-recognition';
import { documentByIdQuery } from '@/db/documents';
import { safeFileName } from '@/lib/documents';
import { ensurePages } from '@/storage/pageStore';

type PageText = { page: number; text: string };

export default function ExtractTextScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useLiveQuery(documentByIdQuery(id), [id]);
  const doc = data[0];

  const [script, setScript] = useState<Script>('latin');
  const [results, setResults] = useState<PageText[] | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const docId = doc?.id;
  useEffect(() => {
    if (!doc) return;
    let active = true;
    (async () => {
      try {
        const pages = await ensurePages(doc);
        const out: PageText[] = [];
        for (const [i, page] of pages.entries()) {
          if (!active) return;
          setProgress(i / pages.length);
          out.push({ page: i + 1, text: (await TextRecognition.recognizeAsync(page.uri, script)).trim() });
        }
        if (active) setResults(out);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Could not read the text');
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, script]);

  function changeScript(value: string) {
    setResults(null);
    setError(null);
    setProgress(0);
    setScript(value as Script);
  }

  const allText = results?.map((r) => (results.length > 1 ? `--- Page ${r.page} ---\n${r.text}` : r.text)).join('\n\n') ?? '';
  const empty = results != null && results.every((r) => r.text === '');

  async function copy() {
    await Clipboard.setStringAsync(allText);
    setMessage('Text copied');
  }

  async function share() {
    if (!doc) return;
    const file = new File(Paths.cache, safeFileName(doc.title, 'txt'));
    file.create({ overwrite: true });
    file.writeSync(allText);
    await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', dialogTitle: doc.title });
  }

  if (!doc) return null;

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <SegmentedButtons
          value={script}
          onValueChange={changeScript}
          buttons={[
            { value: 'latin', label: 'English' },
            { value: 'devanagari', label: 'हिन्दी / Hindi' },
          ]}
        />
        {results == null && !error && <ProgressBar progress={progress} indeterminate={progress === 0} />}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error && <Text variant="bodyMedium">{error}</Text>}
        {results == null && !error && (
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Reading text on your phone… The first time, Google Play services may need a moment to download the language.
          </Text>
        )}
        {empty && (
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            No text found. If the document is in Hindi, switch to हिन्दी above.
          </Text>
        )}
        {results &&
          !empty &&
          results.map((r) => (
            <View key={r.page} style={styles.page}>
              {results.length > 1 && (
                <>
                  <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
                    Page {r.page}
                  </Text>
                  <Divider />
                </>
              )}
              <Text variant="bodyLarge" selectable>
                {r.text || '(no text on this page)'}
              </Text>
            </View>
          ))}
      </ScrollView>

      {results && !empty && (
        <View style={[styles.actions, { backgroundColor: theme.colors.elevation.level2 }]}>
          <Button mode="outlined" icon="content-copy" onPress={copy} style={styles.action}>
            Copy all
          </Button>
          <Button mode="contained" icon="share-variant" onPress={share} style={styles.action}>
            Share as .txt
          </Button>
        </View>
      )}

      <Snackbar visible={message != null} onDismiss={() => setMessage(null)} duration={2500}>
        {message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { padding: 16, gap: 12 },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 20 },
  page: { gap: 8 },
  actions: { flexDirection: 'row', gap: 12, padding: 16 },
  action: { flex: 1 },
});
