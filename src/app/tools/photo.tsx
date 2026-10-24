import { Image } from 'expo-image';
import { launchImageLibraryAsync } from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, RadioButton, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';

import MediaStore from '@modules/media-store';
import { kbToBytes } from '@/lib/compress';
import { defaultScanTitle, formatSize, safeFileName } from '@/lib/documents';
import { compressImageExact, type ImageCompression } from '@/storage/compress';

type Preset = {
  key: string;
  label: string;
  detail: string;
  aspect: [number, number];
  size: { width: number; height: number };
  maxKb: number;
};

// Common Indian requirements; the KB limit can be changed for a specific portal.
const PRESETS: Preset[] = [
  {
    key: 'passport',
    label: 'Passport photo',
    detail: '35 × 45 mm',
    aspect: [7, 9],
    size: { width: 413, height: 531 },
    maxKb: 100,
  },
  {
    key: 'exam',
    label: 'Exam / job form photo',
    detail: '3.5 × 4.5 cm',
    aspect: [7, 9],
    size: { width: 276, height: 354 },
    maxKb: 50,
  },
  {
    key: 'visa',
    label: 'Visa photo',
    detail: '2 × 2 inch (51 × 51 mm)',
    aspect: [1, 1],
    size: { width: 600, height: 600 },
    maxKb: 240,
  },
  {
    key: 'signature',
    label: 'Signature',
    detail: '3.5 × 1.5 cm',
    aspect: [7, 3],
    size: { width: 280, height: 120 },
    maxKb: 20,
  },
];

export default function PhotoToolScreen() {
  const theme = useTheme();
  const [presetKey, setPresetKey] = useState(PRESETS[0].key);
  const preset = PRESETS.find((p) => p.key === presetKey) ?? PRESETS[0];
  const [kbText, setKbText] = useState(String(PRESETS[0].maxKb));
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<ImageCompression | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const kb = Number(kbText);
  const kbValid = Number.isFinite(kb) && kb >= 5;

  function choosePreset(key: string) {
    const next = PRESETS.find((p) => p.key === key) ?? PRESETS[0];
    setPresetKey(next.key);
    setKbText(String(next.maxKb));
    setResult(null);
  }

  async function pickAndMake() {
    const picked = await launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: preset.aspect,
      quality: 1,
    });
    if (picked.canceled) return;
    setWorking(true);
    setResult(null);
    try {
      setResult(await compressImageExact(picked.assets[0].uri, preset.size, kbToBytes(kb)));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not make the photo');
    } finally {
      setWorking(false);
    }
  }

  const fileName = () => safeFileName(defaultScanTitle(new Date(), preset.label), 'jpg');

  async function saveToGallery() {
    if (!result) return;
    try {
      await MediaStore.saveImageToGalleryAsync(result.uri, fileName());
      setMessage('Saved to Pictures/Panna');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save');
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <RadioButton.Group value={presetKey} onValueChange={choosePreset}>
          {PRESETS.map((p) => (
            <RadioButton.Item
              key={p.key}
              value={p.key}
              label={`${p.label}\n${p.detail} · ${p.size.width}×${p.size.height} px`}
              labelVariant="bodyLarge"
              disabled={working}
              style={styles.radio}
            />
          ))}
        </RadioButton.Group>

        <TextInput
          mode="outlined"
          label="Maximum file size"
          keyboardType="number-pad"
          value={kbText}
          onChangeText={(t) => {
            setKbText(t);
            setResult(null);
          }}
          right={<TextInput.Affix text="KB" />}
          disabled={working}
          error={!kbValid}
        />

        <Button mode="contained" icon="image-outline" onPress={pickAndMake} disabled={working || !kbValid}>
          Choose a photo
        </Button>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          You’ll crop the photo to the right shape. For signatures, sign on white paper and photograph it in good light.
        </Text>

        {working && <ActivityIndicator style={styles.loading} />}

        {result && (
          <Card mode="contained">
            <Card.Content style={styles.result}>
              <Image
                source={{ uri: result.uri }}
                style={[styles.preview, { aspectRatio: preset.size.width / preset.size.height }]}
                contentFit="contain"
              />
              <Text variant="titleMedium">
                {formatSize(result.sizeBytes)} · {preset.size.width}×{preset.size.height} px
              </Text>
              <Text variant="bodySmall" style={{ color: result.reached ? theme.colors.primary : theme.colors.error }}>
                {result.reached
                  ? `Under the ${kb} KB limit`
                  : `Can’t get under ${kb} KB at this size. This is the smallest version.`}
              </Text>
            </Card.Content>
            <Card.Actions>
              <Button icon="share-variant" onPress={() => Sharing.shareAsync(result.uri, { mimeType: 'image/jpeg' })}>
                Share
              </Button>
              <Button mode="contained" icon="download" onPress={saveToGallery}>
                Save to Gallery
              </Button>
            </Card.Actions>
          </Card>
        )}
      </ScrollView>
      <Snackbar visible={message != null} onDismiss={() => setMessage(null)} duration={3000}>
        {message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  radio: { paddingVertical: 4 },
  loading: { marginTop: 16 },
  result: { alignItems: 'center', gap: 8 },
  preview: { height: 220, borderRadius: 6, backgroundColor: '#fff' },
});
