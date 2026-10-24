import { useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { Button, SegmentedButtons, Text, useTheme } from 'react-native-paper';
import Svg, { Path } from 'react-native-svg';

import { INK, normalizeStrokes, type InkColor, type Signature, type Stroke } from '@/lib/signature';

type Props = {
  onSave: (signature: Signature, ink: InkColor) => void;
  onCancel: () => void;
};

const toPath = (stroke: Stroke) =>
  stroke.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
  (stroke.length === 1 ? ` L${(stroke[0].x + 0.5).toFixed(1)} ${stroke[0].y.toFixed(1)}` : '');

/** A white pad to sign with a finger. Strokes are kept as points, so the result stays vector. */
export function SignaturePad({ onSave, onCancel }: Props) {
  const theme = useTheme();
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<Stroke>([]);
  const currentRef = useRef<Stroke>([]);
  const [ink, setInk] = useState<InkColor>('blue');
  const [size, setSize] = useState({ width: 0, height: 0 });

  const pan = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    onBegin: (e) => {
      currentRef.current = [{ x: e.x, y: e.y }];
      setCurrent(currentRef.current);
    },
    onUpdate: (e) => {
      currentRef.current = [...currentRef.current, { x: e.x, y: e.y }];
      setCurrent(currentRef.current);
    },
    onFinalize: () => {
      const stroke = currentRef.current;
      currentRef.current = [];
      setCurrent([]);
      if (stroke.length > 0) setStrokes((s) => [...s, stroke]);
    },
  });

  const signature = normalizeStrokes(strokes);
  const strokeWidth = Math.max(2.5, size.height * 0.012);

  return (
    <View style={styles.container}>
      <GestureDetector gesture={pan}>
        <View
          style={[styles.pad, { borderColor: theme.colors.outlineVariant }]}
          onLayout={(e: LayoutChangeEvent) => setSize(e.nativeEvent.layout)}>
          <Svg width={size.width} height={size.height}>
            {[...strokes, current].map((stroke, i) =>
              stroke.length > 0 ? (
                <Path
                  key={i}
                  d={toPath(stroke)}
                  stroke={INK[ink]}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ) : null,
            )}
          </Svg>
          {strokes.length === 0 && current.length === 0 && (
            <Text variant="bodyLarge" style={styles.placeholder} pointerEvents="none">
              Sign here
            </Text>
          )}
          <View style={styles.baseline} pointerEvents="none" />
        </View>
      </GestureDetector>

      <View style={styles.row}>
        <SegmentedButtons
          style={styles.ink}
          value={ink}
          onValueChange={(v) => setInk(v as InkColor)}
          buttons={[
            { value: 'blue', label: 'Blue ink' },
            { value: 'black', label: 'Black ink' },
          ]}
        />
      </View>
      <View style={styles.row}>
        <Button onPress={onCancel}>Cancel</Button>
        <View style={styles.spacer} />
        <Button onPress={() => setStrokes((s) => s.slice(0, -1))} disabled={strokes.length === 0}>
          Undo
        </Button>
        <Button onPress={() => setStrokes([])} disabled={strokes.length === 0}>
          Clear
        </Button>
        <Button mode="contained" onPress={() => signature && onSave(signature, ink)} disabled={!signature}>
          Use
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  pad: { height: 220, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  placeholder: { position: 'absolute', alignSelf: 'center', top: 90, color: '#9aa0a6' },
  baseline: { position: 'absolute', left: 24, right: 24, bottom: 48, height: 1, backgroundColor: '#dadce0' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ink: { flex: 1 },
  spacer: { flex: 1 },
});
