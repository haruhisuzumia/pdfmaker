import { describe, expect, it } from '@jest/globals';
import { degrees, PDFDocument } from 'pdf-lib';

import { displayedSize, displayToPdf, placementToPdf, signPdf, type PageGeometry } from './sign';

const signature = {
  aspect: 3,
  strokes: [
    [
      { x: 0, y: 1 },
      { x: 0.5, y: 0 },
      { x: 1, y: 1 },
    ],
  ],
};

describe('displayToPdf', () => {
  const W = 600;
  const H = 800;

  it.each([0, 90, 180, 270])('maps the displayed page corners onto the media box at %i°', (rotation) => {
    const g: PageGeometry = { width: W, height: H, rotation };
    const shown = displayedSize(g);
    const corners = [
      displayToPdf(g, 0, 0),
      displayToPdf(g, shown.width, 0),
      displayToPdf(g, 0, shown.height),
      displayToPdf(g, shown.width, shown.height),
    ];
    const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;
    expect(new Set(corners.map(key))).toEqual(new Set(['0,0', `${W},0`, `0,${H}`, `${W},${H}`]));
  });

  it('applies the media box origin', () => {
    expect(displayToPdf({ width: 100, height: 100, originX: 10, originY: 20, rotation: 0 }, 0, 0)).toEqual({ x: 10, y: 120 });
  });
});

describe('placementToPdf', () => {
  it.each([0, 90, 180, 270])('keeps the signature upright on a page rotated %i°', (rotation) => {
    const g: PageGeometry = { width: 600, height: 800, rotation };
    const p = placementToPdf(g, { x: 0.25, y: 0.5, w: 0.4, h: 0.1 });

    // pdf-lib draws SVG paths with translate(x, y) · rotate(ccw) · scale(1, -1).
    const rad = (p.rotate * Math.PI) / 180;
    const localRight = { x: Math.cos(rad), y: Math.sin(rad) };
    const localDown = { x: Math.sin(rad), y: -Math.cos(rad) };

    // Directions of "right" and "down" on the displayed page, in PDF space.
    const shown = displayedSize(g);
    const origin = displayToPdf(g, 0.25 * shown.width, 0.5 * shown.height);
    const right = displayToPdf(g, 0.25 * shown.width + 1, 0.5 * shown.height);
    const down = displayToPdf(g, 0.25 * shown.width, 0.5 * shown.height + 1);

    expect({ x: p.x, y: p.y }).toEqual(origin);
    expect(localRight.x).toBeCloseTo(right.x - origin.x);
    expect(localRight.y).toBeCloseTo(right.y - origin.y);
    expect(localDown.x).toBeCloseTo(down.x - origin.x);
    expect(localDown.y).toBeCloseTo(down.y - origin.y);
    expect(p.width).toBeCloseTo(0.4 * shown.width);
  });
});

describe('signPdf', () => {
  it('adds drawing to the chosen page only and keeps the page count', async () => {
    const source = await PDFDocument.create();
    source.addPage([600, 800]);
    source.addPage([600, 800]).setRotation(degrees(90));
    const before = await PDFDocument.load(await source.save());
    const contentLength = (doc: PDFDocument, i: number) => doc.getPage(i).node.normalizedEntries().Contents?.toString().length ?? 0;

    const signed = await PDFDocument.load(
      await signPdf(await source.save(), 1, signature, { x: 0.5, y: 0.7, w: 0.3, h: 0.1 }, 'blue'),
    );
    expect(signed.getPageCount()).toBe(2);
    expect(contentLength(signed, 0)).toBe(contentLength(before, 0));
    expect(contentLength(signed, 1)).toBeGreaterThan(contentLength(before, 1));
  });
});
