import Svg, { Path } from 'react-native-svg';

import { INK, STROKE_RATIO, toSvgPath, type InkColor, type Signature } from '@/lib/signature';

/** Draws a saved signature at the given size, the same way it will appear in the PDF. */
export function SignatureView({
  signature,
  ink,
  width,
  height,
}: {
  signature: Signature;
  ink: InkColor;
  width: number;
  height: number;
}) {
  return (
    <Svg width={width} height={height}>
      <Path
        d={toSvgPath(signature, width, height)}
        stroke={INK[ink]}
        strokeWidth={Math.max(1.5, height * STROKE_RATIO)}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
