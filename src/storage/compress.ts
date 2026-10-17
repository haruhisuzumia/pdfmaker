import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import PdfThumbnail from 'react-native-pdf-thumbnail';

import type { Doc } from '@/db/schema';
import { findBestSettings, MIN_QUALITY, WIDTH_STEPS, type CompressSettings } from '@/lib/compress';
import { createPdfBuilder } from '@/pdf/build';

/** Bytes a PDF adds around its page images (header, xref, per-page objects). */
const PDF_OVERHEAD = 1500;
const PER_PAGE_OVERHEAD = 300;
const MAX_FIX_ATTEMPTS = 3;

export type PdfCompression = {
  bytes: Uint8Array;
  pageCount: number;
  reached: boolean;
  /** First page at the chosen settings, to show the quality. */
  previewUri: string;
};

type Status = (text: string) => void;

async function encode(uri: string, sourceWidth: number, { width, quality }: CompressSettings) {
  const context = ImageManipulator.manipulate(uri);
  if (width < sourceWidth) context.resize({ width });
  const image = await context.renderAsync();
  try {
    return await image.saveAsync({ format: SaveFormat.JPEG, compress: quality });
  } finally {
    image.release();
  }
}

/**
 * Makes a PDF that fits in `targetBytes` by turning each page into a JPEG at the sharpest
 * width/quality that fits. Text becomes part of the image, so this is for scans and portal uploads.
 */
export async function compressPdf(doc: Doc, targetBytes: number, onStatus?: Status): Promise<PdfCompression> {
  if (!doc.localUri) throw new Error('This document is only on Google Drive. Download it first.');
  const work = new Directory(Paths.cache, 'compress');
  if (work.exists) work.delete();
  work.create({ intermediates: true });

  onStatus?.('Reading pages…');
  const pages = await PdfThumbnail.generateAllPages(doc.localUri, { quality: 95, maxWidth: WIDTH_STEPS[0] });
  const overhead = PDF_OVERHEAD + PER_PAGE_OVERHEAD * pages.length;

  try {
    const measure = async (settings: CompressSettings) => {
      onStatus?.(`Trying ${settings.width} px at ${Math.round(settings.quality * 100)}% quality…`);
      let total = overhead;
      for (const page of pages) {
        const out = await encode(page.uri, page.width, settings);
        const file = new File(out.uri);
        total += file.size;
        file.delete();
      }
      return total;
    };

    const best = await findBestSettings(measure, targetBytes);

    // Build the real PDF; if the estimate was a little off, step quality down and try again.
    let settings: CompressSettings = { width: best.width, quality: best.quality };
    for (let attempt = 0; ; attempt++) {
      onStatus?.('Building the PDF…');
      const builder = await createPdfBuilder(doc.title, 'fit');
      let previewUri = '';
      for (const [i, page] of pages.entries()) {
        const out = await encode(page.uri, page.width, settings);
        const file = new File(out.uri);
        await builder.addJpeg(await file.bytes());
        if (i === 0) {
          const preview = new File(work, `preview-${Date.now()}.jpg`);
          file.moveSync(preview);
          previewUri = preview.uri;
        } else {
          file.delete();
        }
      }
      const bytes = await builder.save();
      const fits = bytes.length <= targetBytes;
      const canLower = settings.quality > MIN_QUALITY + 0.001 && attempt < MAX_FIX_ATTEMPTS;
      if (fits || !best.reached || !canLower) {
        return { bytes, pageCount: pages.length, reached: fits, previewUri };
      }
      new File(previewUri).delete();
      settings = { ...settings, quality: Math.max(MIN_QUALITY, settings.quality - 0.05) };
    }
  } finally {
    pages.forEach((p) => {
      const f = new File(p.uri);
      if (f.exists) f.delete();
    });
  }
}

export type ImageCompression = { uri: string; sizeBytes: number; reached: boolean };

/** Resizes a photo to exactly width × height and finds the best JPEG quality under `targetBytes`. */
export async function compressImageExact(
  uri: string,
  { width, height }: { width: number; height: number },
  targetBytes: number,
): Promise<ImageCompression> {
  const image = await ImageManipulator.manipulate(uri).resize({ width, height }).renderAsync();
  try {
    const sizeAt = async (quality: number) => {
      const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: quality });
      const file = new File(out.uri);
      const size = file.size;
      file.delete();
      return size;
    };
    const best = await findBestSettings(({ quality }) => sizeAt(quality), targetBytes, { widths: [width] });
    const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: best.quality });
    return { uri: out.uri, sizeBytes: new File(out.uri).size, reached: best.reached };
  } finally {
    image.release();
  }
}
