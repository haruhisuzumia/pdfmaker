import { describe, expect, it } from '@jest/globals';

import { normalizeStrokes, toSvgPath } from './signature';

describe('normalizeStrokes', () => {
  it('trims to the drawing and scales into a 0–1 box', () => {
    const sig = normalizeStrokes(
      [
        [
          { x: 100, y: 50 },
          { x: 300, y: 150 },
        ],
      ],
      0,
    );
    expect(sig).not.toBeNull();
    expect(sig!.aspect).toBeCloseTo(2);
    expect(sig!.strokes[0]).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
  });

  it('returns null when nothing was drawn', () => {
    expect(normalizeStrokes([])).toBeNull();
    expect(normalizeStrokes([[{ x: 1, y: 1 }]])).toBeNull();
  });
});

describe('toSvgPath', () => {
  it('draws each stroke as a move then lines, scaled to the size', () => {
    const path = toSvgPath(
      {
        aspect: 2,
        strokes: [
          [
            { x: 0, y: 0 },
            { x: 0.5, y: 1 },
          ],
          [{ x: 1, y: 0.5 }],
        ],
      },
      200,
      100,
    );
    expect(path).toBe('M0 0 L100 100 M200 50 L200.4 50');
  });
});
