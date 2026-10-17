import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import {
  GestureDetector,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

type Props = {
  uri: string;
  width: number;
  height: number;
  /** Lets a pager stop swiping while the page is zoomed in. */
  onZoomChange?: (zoomed: boolean) => void;
};

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

/** A page image with pinch, pan and double-tap zoom. */
export function ZoomableImage({ uri, width, height, onZoomChange }: Props) {
  const [zoomed, setZoomed] = useState(false);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const setZoomedJS = (value: boolean) => {
    setZoomed(value);
    onZoomChange?.(value);
  };

  const reset = () => {
    'worklet';
    scale.value = withSpring(1);
    savedScale.value = 1;
    tx.value = withSpring(0);
    ty.value = withSpring(0);
    savedTx.value = 0;
    savedTy.value = 0;
    scheduleOnRN(setZoomedJS, false);
  };

  const pinch = usePinchGesture({
    onUpdate: (e) => {
      'worklet';
      scale.value = clamp(savedScale.value * e.scale, 1, MAX_SCALE);
    },
    onDeactivate: () => {
      'worklet';
      if (scale.value <= 1.01) {
        reset();
        return;
      }
      savedScale.value = scale.value;
      scheduleOnRN(setZoomedJS, true);
    },
  });

  // Panning only while zoomed, so a normal swipe still turns the page.
  const pan = usePanGesture({
    enabled: zoomed,
    onUpdate: (e) => {
      'worklet';
      const maxX = (width * (scale.value - 1)) / 2;
      const maxY = (height * (scale.value - 1)) / 2;
      tx.value = clamp(savedTx.value + e.translationX, -maxX, maxX);
      ty.value = clamp(savedTy.value + e.translationY, -maxY, maxY);
    },
    onDeactivate: () => {
      'worklet';
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: () => {
      'worklet';
      if (savedScale.value > 1) {
        reset();
      } else {
        scale.value = withSpring(DOUBLE_TAP_SCALE);
        savedScale.value = DOUBLE_TAP_SCALE;
        scheduleOnRN(setZoomedJS, true);
      }
    },
  });

  const gesture = useSimultaneousGestures(pinch, pan, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, height }, animatedStyle]}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
      </Animated.View>
    </GestureDetector>
  );
}
