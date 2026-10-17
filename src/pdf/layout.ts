import type { PageSize } from '@/store/settings';

/** Paper sizes in PDF points (1/72 inch), portrait. */
export const PAPER: Record<Exclude<PageSize, 'fit'>, { w: number; h: number }> = {
  a4: { w: 595, h: 842 },
  letter: { w: 612, h: 792 },
};

/** Width used for "Fit image" pages, so they open at the same zoom as A4 in viewers. */
export const FIT_WIDTH = 595;

export type PageLayout = { pageW: number; pageH: number; x: number; y: number; w: number; h: number };

/**
 * Where an image of imgW×imgH pixels goes on a PDF page.
 * Paper sizes turn landscape for landscape images; the image is scaled to fit and centred.
 * "fit" makes the page the image's own shape, so there are no borders.
 */
export function layoutPage(imgW: number, imgH: number, pageSize: PageSize): PageLayout {
  if (pageSize === 'fit') {
    const pageH = Math.round((FIT_WIDTH * imgH) / imgW);
    return { pageW: FIT_WIDTH, pageH, x: 0, y: 0, w: FIT_WIDTH, h: pageH };
  }

  const paper = PAPER[pageSize];
  const landscape = imgW > imgH;
  const pageW = landscape ? paper.h : paper.w;
  const pageH = landscape ? paper.w : paper.h;
  const scale = Math.min(pageW / imgW, pageH / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  return { pageW, pageH, x: (pageW - w) / 2, y: (pageH - h) / 2, w, h };
}
