import { degrees, LineCapStyle, PDFDocument, rgb } from 'pdf-lib';

import { INK, STROKE_RATIO, toSvgPath, type InkColor, type Signature } from '@/lib/signature';

/** A rectangle as fractions (0–1) of the page as it is displayed, origin top-left. */
export type PageRect = { x: number; y: number; w: number; h: number };

export type PageGeometry = {
  /** Unrotated media box size and origin, in points. */
  width: number;
  height: number;
  originX?: number;
  originY?: number;
  /** The page's /Rotate, clockwise: 0, 90, 180 or 270. */
  rotation: number;
};

export type Placement = {
  /** PDF point where the signature's top-left corner goes. */
  x: number;
  y: number;
  /** Size of the signature in points, as seen on the displayed page. */
  width: number;
  height: number;
  /** Counter-clockwise rotation that keeps the signature upright on the displayed page. */
  rotate: number;
};

function hexColor(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const normalizeRotation = (r: number) => (((Math.round(r / 90) * 90) % 360) + 360) % 360;

/** Converts a point on the displayed page (points, origin top-left) into PDF coordinates. */
export function displayToPdf(g: PageGeometry, dx: number, dy: number): { x: number; y: number } {
  const { width: W, height: H, originX = 0, originY = 0 } = g;
  let p: { x: number; y: number };
  switch (normalizeRotation(g.rotation)) {
    case 90:
      p = { x: dy, y: dx };
      break;
    case 180:
      p = { x: W - dx, y: dy };
      break;
    case 270:
      p = { x: W - dy, y: H - dx };
      break;
    default:
      p = { x: dx, y: H - dy };
  }
  return { x: p.x + originX, y: p.y + originY };
}

export function displayedSize(g: PageGeometry) {
  const sideways = normalizeRotation(g.rotation) % 180 !== 0;
  return sideways ? { width: g.height, height: g.width } : { width: g.width, height: g.height };
}

/** Where and how to draw a signature placed at `rect` on the displayed page. */
export function placementToPdf(g: PageGeometry, rect: PageRect): Placement {
  const shown = displayedSize(g);
  const topLeft = displayToPdf(g, rect.x * shown.width, rect.y * shown.height);
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: rect.w * shown.width,
    height: rect.h * shown.height,
    rotate: normalizeRotation(g.rotation),
  };
}

/** Draws the signature as vector strokes on one page. Other pages and existing content are untouched. */
export async function signPdf(
  bytes: Uint8Array,
  pageIndex: number,
  signature: Signature,
  rect: PageRect,
  ink: InkColor,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  const page = pdf.getPage(pageIndex);
  const box = page.getMediaBox();
  const placement = placementToPdf(
    { width: box.width, height: box.height, originX: box.x, originY: box.y, rotation: page.getRotation().angle },
    rect,
  );

  page.drawSvgPath(toSvgPath(signature, placement.width, placement.height), {
    x: placement.x,
    y: placement.y,
    rotate: degrees(placement.rotate),
    borderColor: hexColor(INK[ink]),
    borderWidth: Math.max(0.8, placement.height * STROKE_RATIO),
    borderLineCap: LineCapStyle.Round,
  });
  pdf.setModificationDate(new Date());
  return pdf.save();
}
