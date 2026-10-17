import { PDFDocument } from 'pdf-lib';

import { PAPER } from './layout';

const MM = 72 / 25.4;
/** ISO/IEC 7810 ID-1 card (Aadhaar, PAN, driving licence, bank cards): 85.6 × 54 mm. */
export const CARD = { long: 85.6 * MM, short: 53.98 * MM };
const TOP_MARGIN = 30 * MM;
const GAP = 15 * MM;

export type Rect = { x: number; y: number; w: number; h: number };

/**
 * Places up to two card images (front, back) on an A4 page at real size, centred and stacked,
 * so a print of the page matches a photocopy of the card. Portrait images get a portrait card box.
 */
export function idCardLayout(images: readonly { width: number; height: number }[]): Rect[] {
  const page = PAPER.a4;
  let top = page.h - TOP_MARGIN;
  return images.slice(0, 2).map(({ width, height }) => {
    const portrait = height > width;
    const boxW = portrait ? CARD.short : CARD.long;
    const boxH = portrait ? CARD.long : CARD.short;
    const scale = Math.min(boxW / width, boxH / height);
    const w = width * scale;
    const h = height * scale;
    const rect = { x: (page.w - w) / 2, y: top - h, w, h };
    top -= h + GAP;
    return rect;
  });
}

export async function buildIdCardPdf(jpegs: readonly Uint8Array[], title: string): Promise<Uint8Array> {
  if (jpegs.length === 0) throw new Error('Scan the front of the card first.');
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setProducer('PDF Maker');
  pdf.setCreator('PDF Maker');

  const page = pdf.addPage([PAPER.a4.w, PAPER.a4.h]);
  const images = await Promise.all(jpegs.slice(0, 2).map((bytes) => pdf.embedJpg(bytes)));
  idCardLayout(images).forEach((rect, i) => page.drawImage(images[i], { x: rect.x, y: rect.y, width: rect.w, height: rect.h }));
  return pdf.save();
}
