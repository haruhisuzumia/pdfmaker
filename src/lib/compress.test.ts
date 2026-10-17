import { describe, expect, it } from '@jest/globals';

import { findBestSettings, formatKb, MAX_QUALITY, MIN_QUALITY, type CompressSettings } from './compress';

/** A fake encoder: size grows with pixel area and quality, like JPEG roughly does. */
const fakeSize = ({ width, quality }: CompressSettings) => Math.round(width * width * 0.1 * (0.2 + quality));

function measuring() {
  const calls: CompressSettings[] = [];
  const measure = async (s: CompressSettings) => {
    calls.push(s);
    return fakeSize(s);
  };
  return { calls, measure };
}

describe('findBestSettings', () => {
  it('keeps full width and quality when the file already fits', async () => {
    const { measure, calls } = measuring();
    const result = await findBestSettings(measure, 10_000_000);
    expect(result).toMatchObject({ width: 1600, quality: MAX_QUALITY, reached: true });
    expect(calls).toHaveLength(1);
  });

  it('finds the sharpest setting that fits and never exceeds the target', async () => {
    const target = 70_000;
    const { measure } = measuring();
    const result = await findBestSettings(measure, target);
    expect(result.reached).toBe(true);
    expect(result.bytes).toBeLessThanOrEqual(target);
    // The next wider step cannot fit even at minimum quality.
    expect(fakeSize({ width: 1300, quality: MIN_QUALITY })).toBeGreaterThan(target);
    expect(result.width).toBe(1100);
    // Quality was pushed up as far as the target allows (within the search precision).
    expect(fakeSize({ width: 1100, quality: result.quality + 0.05 })).toBeGreaterThan(target);
  });

  it('reports when the target cannot be reached', async () => {
    const { measure } = measuring();
    const result = await findBestSettings(measure, 100);
    expect(result).toMatchObject({ width: 480, quality: MIN_QUALITY, reached: false });
    expect(result.bytes).toBeGreaterThan(100);
  });

  it('works with a single fixed width (exact-size photos)', async () => {
    const { measure } = measuring();
    const result = await findBestSettings(measure, 20_000, { widths: [413] });
    expect(result.width).toBe(413);
    expect(result.reached).toBe(true);
    expect(result.bytes).toBeLessThanOrEqual(20_000);
  });

  it('does not measure the same settings twice', async () => {
    const { measure, calls } = measuring();
    await findBestSettings(measure, 70_000);
    const keys = calls.map((c) => `${c.width}@${c.quality}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('formatKb', () => {
  it('switches to MB from 1024 KB', () => {
    expect(formatKb(100)).toBe('100 KB');
    expect(formatKb(1024)).toBe('1 MB');
    expect(formatKb(1536)).toBe('1.5 MB');
  });
});
