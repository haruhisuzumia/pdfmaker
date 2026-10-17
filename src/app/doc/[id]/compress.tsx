import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, HelperText, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';

import { documentByIdQuery } from '@/db/documents';
import { formatKb, kbToBytes, SIZE_PRESETS_KB } from '@/lib/compress';
import { formatSize } from '@/lib/documents';
import { compressPdf, type PdfCompression } from '@/storage/compress';
import { replaceDocumentFile, saveDerivedCopy } from '@/storage/localStore';

export default function CompressScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useLiveQuery(documentByIdQuery(id), [id]);
  const doc = data[0];

  const [targetKb, setTargetKb] = useState(100);
  const [customText, setCustomText] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<(PdfCompression & { targetKb: number }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!doc) return null;

  const working = status != null;
  const alreadySmall = doc.sizeBytes > 0 && doc.sizeBytes <= kbToBytes(targetKb);

  function pickPreset(kb: number) {
    setTargetKb(kb);
    setCustomText('');
    setResult(null);
  }

  function setCustom(text: string) {
    setCustomText(text);
    const kb = Number(text);
    if (Number.isFinite(kb) && kb >= 10) {
      setTargetKb(Math.round(kb));
      setResult(null);
    }
  }

  async function compress() {
    setResult(null);
    setStatus('Starting…');
    try {
      const out = await compressPdf(doc!, kbToBytes(targetKb), setStatus);
      setResult({ ...out, targetKb });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not compress this document');
    } finally {
      setStatus(null);
    }
  }

  async function save(mode: 'copy' | 'replace') {
    if (!result) return;
    setSaving(true);
    try {
      const label = `under ${formatKb(result.targetKb)}`;
      const newId =
        mode === 'copy'
          ? await saveDerivedCopy(doc!, result.bytes, result.pageCount, label)
          : await replaceDocumentFile(doc!, result.bytes, result.pageCount, label);
      router.replace({ pathname: '/doc/[id]', params: { id: newId } });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save');
      setSaving(false);
    }
  }

  const customInvalid = customText !== '' && !(Number(customText) >= 10);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text variant="titleMedium" numberOfLines={1}>
            {doc.title}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Now {formatSize(doc.sizeBytes)}
            {doc.pageCount ? ` · ${doc.pageCount} ${doc.pageCount === 1 ? 'page' : 'pages'}` : ''}
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="labelLarge">Make it smaller than</Text>
          <View style={styles.chips}>
            {SIZE_PRESETS_KB.map((kb) => (
              <Chip
                key={kb}
                selected={customText === '' && targetKb === kb}
                showSelectedOverlay
                onPress={() => pickPreset(kb)}
                disabled={working}>
                {formatKb(kb)}
              </Chip>
            ))}
          </View>
          <TextInput
            mode="outlined"
            dense
            label="Or type a limit in KB"
            keyboardType="number-pad"
            value={customText}
            onChangeText={setCustom}
            disabled={working}
            right={<TextInput.Affix text="KB" />}
          />
          <HelperText type="error" visible={customInvalid}>
            Enter at least 10 KB.
          </HelperText>
        </View>

        {alreadySmall && !result ? (
          <Text variant="bodyMedium" style={{ color: theme.colors.primary }}>
            This document is already under {formatKb(targetKb)}.
          </Text>
        ) : (
          <Button
            mode="contained"
            icon="arrow-collapse-vertical"
            onPress={compress}
            disabled={working || saving || customInvalid}>
            Compress to under {formatKb(targetKb)}
          </Button>
        )}

        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          Pages are saved as images, so text in the result can’t be selected. Your original stays as it is unless you choose
          Replace.
        </Text>

        {working && (
          <View style={styles.status}>
            <ActivityIndicator />
            <Text variant="bodyMedium">{status}</Text>
          </View>
        )}

        {result && (
          <Card mode="contained">
            <Card.Content style={styles.result}>
              <Image source={{ uri: result.previewUri }} style={styles.preview} contentFit="contain" />
              <View style={styles.resultText}>
                <Text variant="titleLarge">{formatSize(result.bytes.length)}</Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  was {formatSize(doc.sizeBytes)}
                </Text>
                <Text variant="bodySmall" style={{ color: result.reached ? theme.colors.primary : theme.colors.error }}>
                  {result.reached
                    ? `Fits the ${formatKb(result.targetKb)} limit`
                    : `This is as small as it gets. Still over ${formatKb(result.targetKb)}. Try removing pages first.`}
                </Text>
              </View>
            </Card.Content>
            <Card.Actions>
              <Button onPress={() => save('replace')} disabled={saving}>
                Replace original
              </Button>
              <Button mode="contained" onPress={() => save('copy')} loading={saving} disabled={saving}>
                Save as new copy
              </Button>
            </Card.Actions>
          </Card>
        )}
      </ScrollView>
      <Snackbar visible={message != null} onDismiss={() => setMessage(null)} duration={4000}>
        {message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 16 },
  section: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  result: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  preview: { width: 96, height: 128, borderRadius: 6, backgroundColor: '#fff' },
  resultText: { flex: 1, gap: 4 },
});
