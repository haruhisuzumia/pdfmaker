import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import { Button, IconButton, List, Modal, Portal, Snackbar, Text, useTheme } from 'react-native-paper';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SignaturePad } from '@/components/SignaturePad';
import { SignatureView } from '@/components/SignatureView';
import { documentByIdQuery } from '@/db/documents';
import type { InkColor, Signature } from '@/lib/signature';
import { signPdf } from '@/pdf/sign';
import { readPdfBytes, replaceDocumentFile } from '@/storage/localStore';
import { ensurePages, type PageImage } from '@/storage/pageStore';
import { deleteSignature, loadSignature, saveSignature, savedSignaturesQuery, type SavedSignature } from '@/storage/signatures';

const THUMB_HEIGHT = 72;

function clamp(v: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(v, min), max);
}

/** Position and width of the placed signature, in page-box pixels. */
type Placement = { x: number; y: number; w: number };

/** The signature on top of the page: drag to move, pinch to resize. Reports where it ends up. */
function PlacedSignature({
  signature,
  ink,
  box,
  initial,
  onChange,
}: {
  signature: Signature;
  ink: InkColor;
  box: { width: number; height: number };
  initial: Placement;
  onChange: (placement: Placement) => void;
}) {
  const x = useSharedValue(initial.x);
  const y = useSharedValue(initial.y);
  const w = useSharedValue(initial.w);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startW = useSharedValue(0);
  const [size, setSize] = useState({ width: initial.w, height: initial.w / signature.aspect });

  const report = () => {
    'worklet';
    scheduleOnRN(onChange, { x: x.value, y: y.value, w: w.value });
  };

  const pan = usePanGesture({
    minDistance: 0,
    onBegin: () => {
      'worklet';
      startX.value = x.value;
      startY.value = y.value;
    },
    onUpdate: (e) => {
      'worklet';
      const h = w.value / signature.aspect;
      x.value = clamp(startX.value + e.translationX, 0, box.width - w.value);
      y.value = clamp(startY.value + e.translationY, 0, box.height - h);
    },
    onFinalize: report,
  });

  const pinch = usePinchGesture({
    onBegin: () => {
      'worklet';
      startW.value = w.value;
    },
    onUpdate: (e) => {
      'worklet';
      const maxW = Math.min(box.width, box.height * signature.aspect);
      const next = clamp(startW.value * e.scale, 40, maxW);
      const cx = x.value + w.value / 2;
      const cy = y.value + w.value / signature.aspect / 2;
      w.value = next;
      x.value = clamp(cx - next / 2, 0, box.width - next);
      y.value = clamp(cy - next / signature.aspect / 2, 0, box.height - next / signature.aspect);
    },
    onFinalize: report,
  });

  const style = useAnimatedStyle(() => ({
    left: x.value,
    top: y.value,
    width: w.value,
    height: w.value / signature.aspect,
  }));

  return (
    <GestureDetector gesture={useSimultaneousGestures(pan, pinch)}>
      <Animated.View
        style={[styles.placed, style]}
        onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
        <SignatureView signature={signature} ink={ink} width={size.width} height={size.height} />
      </Animated.View>
    </GestureDetector>
  );
}

export default function SignScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useLiveQuery(documentByIdQuery(id), [id]);
  const doc = data[0];
  const { data: savedRows } = useLiveQuery(savedSignaturesQuery());
  const saved = useMemo(() => savedRows.map(loadSignature).filter((s) => s != null), [savedRows]);

  const [pages, setPages] = useState<PageImage[] | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [chosen, setChosen] = useState<{ signature: Signature; ink: InkColor } | null>(null);
  const [sheet, setSheet] = useState<'closed' | 'list' | 'pad'>('closed');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [placement, setPlacement] = useState<Placement>({ x: 0, y: 0, w: 0 });
  // Bumped on every new placement so the overlay starts fresh at the new spot.
  const [placementKey, setPlacementKey] = useState(0);

  const docId = doc?.id;
  useEffect(() => {
    if (!doc) return;
    ensurePages(doc).then(setPages, (e: unknown) => setMessage(e instanceof Error ? e.message : 'Could not show the pages'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  const page = pages?.[pageIndex];
  // Fit the page in the space between the header and the bottom bar.
  const maxW = window.width - 32;
  const maxH = window.height * 0.55;
  const box = page
    ? page.width / page.height > maxW / maxH
      ? { width: maxW, height: (maxW * page.height) / page.width }
      : { width: (maxH * page.width) / page.height, height: maxH }
    : { width: maxW, height: maxH };

  function place(signature: Signature, ink: InkColor) {
    const width = Math.min(box.width * 0.4, box.height * signature.aspect);
    setPlacement({ x: (box.width - width) / 2, y: box.height * 0.7 - width / signature.aspect / 2, w: width });
    setPlacementKey((k) => k + 1);
    setChosen({ signature, ink });
    setSheet('closed');
  }

  async function saveAndPlace(signature: Signature, ink: InkColor) {
    await saveSignature(signature, ink);
    place(signature, ink);
  }

  function choosePage(index: number) {
    setPageIndex(index);
    setChosen(null);
  }

  async function apply() {
    if (!doc || !chosen) return;
    setSaving(true);
    try {
      const rect = {
        x: placement.x / box.width,
        y: placement.y / box.height,
        w: placement.w / box.width,
        h: placement.w / chosen.signature.aspect / box.height,
      };
      const bytes = await signPdf(await readPdfBytes(doc), pageIndex, chosen.signature, rect, chosen.ink);
      const resultId = await replaceDocumentFile(doc, bytes, doc.pageCount || pages?.length || 1, 'signed');
      if (resultId === doc.id) router.back();
      else router.replace({ pathname: '/doc/[id]', params: { id: resultId } });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not sign the document');
      setSaving(false);
    }
  }

  if (!doc) return null;

  return (
    <View style={styles.screen}>
      {pages && pages.length > 1 && (
        <FlatList
          horizontal
          data={pages}
          keyExtractor={(p) => p.uri}
          style={styles.strip}
          contentContainerStyle={styles.stripContent}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => choosePage(index)}
              accessibilityLabel={`Page ${index + 1}`}
              style={[
                styles.thumb,
                {
                  width: (THUMB_HEIGHT * item.width) / item.height,
                  borderColor: index === pageIndex ? theme.colors.primary : 'transparent',
                },
              ]}>
              <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            </Pressable>
          )}
        />
      )}

      <View style={styles.stage}>
        {!page ? (
          <ActivityIndicator />
        ) : (
          <View style={[box, styles.page]}>
            <Image source={{ uri: page.uri }} style={StyleSheet.absoluteFill} contentFit="fill" />
            {chosen && (
              <PlacedSignature
                key={placementKey}
                signature={chosen.signature}
                ink={chosen.ink}
                box={box}
                initial={placement}
                onChange={setPlacement}
              />
            )}
          </View>
        )}
        <Text variant="bodySmall" style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
          {chosen ? 'Drag to move · pinch to resize' : `Page ${pageIndex + 1}${pages ? ` of ${pages.length}` : ''}`}
        </Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.elevation.level2 }]}>
        {chosen ? (
          <>
            <Button onPress={() => setChosen(null)} disabled={saving}>
              Remove
            </Button>
            <Button mode="contained" icon="check" onPress={apply} loading={saving} disabled={saving} style={styles.grow}>
              Apply signature
            </Button>
          </>
        ) : (
          <Button
            mode="contained"
            icon="draw"
            onPress={() => setSheet(saved.length ? 'list' : 'pad')}
            disabled={!page}
            style={styles.grow}>
            Add signature
          </Button>
        )}
      </View>

      <Portal>
        <Modal
          visible={sheet !== 'closed'}
          onDismiss={() => setSheet('closed')}
          contentContainerStyle={[styles.sheet, { backgroundColor: theme.colors.elevation.level2 }]}
          style={styles.modal}>
          {sheet === 'pad' ? (
            <SignaturePad
              onSave={(sig, ink) => saveAndPlace(sig, ink)}
              onCancel={() => setSheet(saved.length ? 'list' : 'closed')}
            />
          ) : (
            <ScrollView>
              <Text variant="titleMedium" style={styles.sheetTitle}>
                Your signatures
              </Text>
              {saved.map((sig: SavedSignature) => (
                <View key={sig.id} style={styles.savedRow}>
                  <Pressable style={styles.savedSig} onPress={() => place(sig, sig.ink)} accessibilityLabel="Use this signature">
                    <SignatureView
                      signature={sig}
                      ink={sig.ink}
                      width={Math.min(220, 56 * sig.aspect)}
                      height={Math.min(220, 56 * sig.aspect) / sig.aspect}
                    />
                  </Pressable>
                  <IconButton
                    icon="delete-outline"
                    accessibilityLabel="Delete signature"
                    onPress={() => deleteSignature(sig.id)}
                  />
                </View>
              ))}
              <List.Item
                title="Draw a new signature"
                left={(p) => <List.Icon {...p} icon="draw" />}
                onPress={() => setSheet('pad')}
              />
            </ScrollView>
          )}
        </Modal>
      </Portal>

      <Snackbar visible={message != null} onDismiss={() => setMessage(null)} duration={4000}>
        {message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  strip: { flexGrow: 0 },
  stripContent: { padding: 12, gap: 8 },
  thumb: { height: THUMB_HEIGHT, borderRadius: 4, borderWidth: 2, overflow: 'hidden' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  page: { backgroundColor: '#fff', elevation: 2 },
  placed: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(0,105,92,0.6)', borderStyle: 'dashed' },
  hint: { textAlign: 'center' },
  footer: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  grow: { flex: 1 },
  modal: { justifyContent: 'flex-end', margin: 0 },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32, maxHeight: '80%' },
  sheetTitle: { marginBottom: 8 },
  savedRow: { flexDirection: 'row', alignItems: 'center' },
  savedSig: { flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 8, marginVertical: 4, alignItems: 'flex-start' },
});
