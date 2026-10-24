export type Point = { x: number; y: number };
export type Stroke = Point[];

/** A signature as strokes in a 0–1 box, with the box's width/height ratio. */
export type Signature = { strokes: Stroke[]; aspect: number };

export const INK = {
  blue: '#1A3D8F',
  black: '#111111',
} as const;
export type InkColor = keyof typeof INK;

/** Fraction of the signature's height used as stroke width. */
export const STROKE_RATIO = 0.035;

/**
 * Trims drawn strokes (in pad pixels) to their bounding box plus a small margin and scales them
 * into a 0–1 box, so a signature can be placed at any size. Returns null if nothing was drawn.
 */
export function normalizeStrokes(strokes: readonly Stroke[], margin = 6): Signature | null {
  const points = strokes.flat();
  if (points.length < 2) return null;

  const minX = Math.min(...points.map((p) => p.x)) - margin;
  const maxX = Math.max(...points.map((p) => p.x)) + margin;
  const minY = Math.min(...points.map((p) => p.y)) - margin;
  const maxY = Math.max(...points.map((p) => p.y)) + margin;
  const w = Math.max(maxX - minX, 1);
  const h = Math.max(maxY - minY, 1);

  return {
    aspect: w / h,
    strokes: strokes
      .filter((s) => s.length > 0)
      .map((s) => s.map((p) => ({ x: round((p.x - minX) / w), y: round((p.y - minY) / h) }))),
  };
}

const round = (n: number) => Math.round(n * 10000) / 10000;

/** SVG path for the signature scaled to width × height (y down, as in SVG and pdf-lib's drawSvgPath). */
export function toSvgPath(sig: Signature, width: number, height: number): string {
  return sig.strokes
    .map((stroke) => {
      const pts = stroke.length === 1 ? [stroke[0], { x: stroke[0].x + 0.002, y: stroke[0].y }] : stroke;
      return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x * width)} ${fmt(p.y * height)}`).join(' ');
    })
    .join(' ');
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);
