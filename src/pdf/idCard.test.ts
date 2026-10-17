/// <reference types="node" />
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PDFDocument } from 'pdf-lib';

import { buildIdCardPdf, CARD, idCardLayout } from './idCard';

const jpeg = new Uint8Array(readFileSync(join(__dirname, '__fixtures__/portrait-30x40.jpg')));

describe('idCardLayout', () => {
  it('prints a landscape card at real size, centred on A4', () => {
    const [front] = idCardLayout([{ width: 1712, height: 1080 }]);
    expect(front.w).toBeCloseTo(CARD.long, 0);
    expect(front.h).toBeLessThanOrEqual(CARD.short + 0.01);
    expect(front.x + front.w / 2).toBeCloseTo(595 / 2);
  });

  it('stacks the back below the front without overlapping', () => {
    const [front, back] = idCardLayout([
      { width: 1712, height: 1080 },
      { width: 1712, height: 1080 },
    ]);
    expect(back.y + back.h).toBeLessThan(front.y);
    expect(back.y).toBeGreaterThan(0);
  });

  it('uses a portrait box for portrait cards and ignores extra images', () => {
    const rects = idCardLayout([
      { width: 1080, height: 1712 },
      { width: 1080, height: 1712 },
      { width: 1080, height: 1712 },
    ]);
    expect(rects).toHaveLength(2);
    expect(rects[0].h).toBeCloseTo(CARD.long, 0);
  });
});

describe('buildIdCardPdf', () => {
  it('makes a single A4 page', async () => {
    const pdf = await PDFDocument.load(await buildIdCardPdf([jpeg, jpeg], 'ID card'));
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 595, height: 842 });
  });
});
