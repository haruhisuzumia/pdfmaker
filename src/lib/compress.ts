export type CompressSettings = { width: number; quality: number };

export type CompressResult = CompressSettings & {
  bytes: number;
  /** False when even the smallest setting is still over the target. */
  reached: boolean;
};

/** Page widths tried from sharpest to smallest; each step loses some detail but saves a lot of bytes. */
export const WIDTH_STEPS = [1600, 1300, 1100, 900, 750, 600, 480];
export const MIN_QUALITY = 0.25;
export const MAX_QUALITY = 0.9;

/** Common portal limits, in KB. */
export const SIZE_PRESETS_KB = [50, 100, 200, 500, 1024];

/**
 * Finds the sharpest settings whose output fits in `targetBytes`: the widest width that can fit,
 * then the highest JPEG quality at that width (binary search). `measure` returns the output size
 * for given settings; results are cached, so it runs as few times as possible.
 */
export async function findBestSettings(
  measure: (settings: CompressSettings) => Promise<number>,
  targetBytes: number,
  { widths = WIDTH_STEPS, iterations = 5 }: { widths?: readonly number[]; iterations?: number } = {},
): Promise<CompressResult> {
  const cache = new Map<string, number>();
  const sizeOf = async (s: CompressSettings) => {
    const key = `${s.width}@${s.quality.toFixed(3)}`;
    let bytes = cache.get(key);
    if (bytes === undefined) {
      bytes = await measure(s);
      cache.set(key, bytes);
    }
    return bytes;
  };

  for (const width of widths) {
    const best = await sizeOf({ width, quality: MAX_QUALITY });
    if (best <= targetBytes) return { width, quality: MAX_QUALITY, bytes: best, reached: true };

    const worst = await sizeOf({ width, quality: MIN_QUALITY });
    if (worst > targetBytes) continue;

    // Largest quality in [MIN, MAX] that still fits.
    let low = MIN_QUALITY;
    let lowBytes = worst;
    let high = MAX_QUALITY;
    for (let i = 0; i < iterations; i++) {
      const mid = (low + high) / 2;
      const bytes = await sizeOf({ width, quality: mid });
      if (bytes <= targetBytes) {
        low = mid;
        lowBytes = bytes;
      } else {
        high = mid;
      }
    }
    return { width, quality: low, bytes: lowBytes, reached: true };
  }

  const smallest = { width: widths[widths.length - 1], quality: MIN_QUALITY };
  return { ...smallest, bytes: await sizeOf(smallest), reached: false };
}

export function kbToBytes(kb: number) {
  return Math.round(kb * 1024);
}

export function formatKb(kb: number) {
  return kb >= 1024 ? `${+(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}
