import { degrees, EncryptedPDFError, PDFDocument } from 'pdf-lib';

import type { PageSize } from '@/store/settings';

import { layoutPage } from './layout';

export type EditPage =
  | { from: 'pdf'; index: number; rotation: number }
  | { from: 'image'; bytes: Uint8Array; rotation?: 0 };

export class PdfEditError extends Error {}

async function loadForEditing(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    if (e instanceof EncryptedPDFError) throw new PdfEditError('This PDF is protected and can’t be edited.');
    throw new PdfEditError('This PDF looks damaged and can’t be edited.');
  }
}

async function newPdf(title: string) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setProducer('PDF Maker');
  pdf.setCreator('PDF Maker');
  const now = new Date();
  pdf.setCreationDate(now);
  pdf.setModificationDate(now);
  return pdf;
}

/**
 * Builds the edited document: existing pages are copied (not re-rendered), so text and quality
 * are kept; `rotation` is added to each page's own rotation. New pages are embedded JPEGs.
 */
export async function rebuildPdf(
  source: Uint8Array | null,
  pages: readonly EditPage[],
  { title, pageSize }: { title: string; pageSize: PageSize },
): Promise<Uint8Array> {
  if (pages.length === 0) throw new PdfEditError('A document needs at least one page.');
  const src = source ? await loadForEditing(source) : null;
  const out = await newPdf(title);

  for (const page of pages) {
    if (page.from === 'pdf') {
      if (!src) throw new PdfEditError('Missing the original PDF.');
      const [copied] = await out.copyPages(src, [page.index]);
      const angle = (((copied.getRotation().angle + page.rotation) % 360) + 360) % 360;
      copied.setRotation(degrees(angle));
      out.addPage(copied);
    } else {
      const image = await out.embedJpg(page.bytes);
      const l = layoutPage(image.width, image.height, pageSize);
      out.addPage([l.pageW, l.pageH]).drawImage(image, { x: l.x, y: l.y, width: l.w, height: l.h });
    }
  }
  return out.save();
}

/** Joins whole PDFs in the given order. */
export async function mergePdfs(sources: readonly Uint8Array[], title: string): Promise<Uint8Array> {
  if (sources.length < 2) throw new PdfEditError('Choose at least two documents to merge.');
  const out = await newPdf(title);
  for (const bytes of sources) {
    const src = await loadForEditing(bytes);
    const copied = await out.copyPages(src, src.getPageIndices());
    copied.forEach((p) => out.addPage(p));
  }
  return out.save();
}

/** A new PDF with only the chosen pages (zero-based), in the given order. */
export async function extractPages(source: Uint8Array, indices: readonly number[], title: string): Promise<Uint8Array> {
  if (indices.length === 0) throw new PdfEditError('Choose at least one page.');
  const src = await loadForEditing(source);
  const out = await newPdf(title);
  const copied = await out.copyPages(src, [...indices]);
  copied.forEach((p) => out.addPage(p));
  return out.save();
}

export async function countPages(bytes: Uint8Array): Promise<number> {
  return (await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true })).getPageCount();
}
