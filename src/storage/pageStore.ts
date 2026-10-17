import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import PdfThumbnail, { PdfThumbnailErrorCodes } from 'react-native-pdf-thumbnail';

import MediaStore from '@modules/media-store';
import type { Doc } from '@/db/schema';
import type { Rotation } from '@/lib/draftPages';

/** Long side cap for stored pages: A4 at 300 dpi. */
const MAX_PAGE_PX = 2480;
const PAGE_QUALITY = 0.85;
const THUMB_WIDTH = 240;
/** Rendering width for pages of imported PDFs (enough for zooming on a phone). */
const RENDER_WIDTH = 1600;

export type PageImage = { uri: string; width: number; height: number };
type Manifest = { pages: { file: string; width: number; height: number }[] };

const pagesRoot = () => new Directory(Paths.document, 'pages');
const thumbsRoot = () => new Directory(Paths.document, 'thumbs');

export const pagesDir = (docId: string) => new Directory(pagesRoot(), docId);
const manifestFile = (docId: string) => new File(pagesDir(docId), 'pages.json');
const pageFileName = (index: number) => `${String(index + 1).padStart(3, '0')}.jpg`;

function writeManifest(docId: string, manifest: Manifest) {
  const file = manifestFile(docId);
  file.create({ overwrite: true });
  file.writeSync(JSON.stringify(manifest));
}

function resetDir(dir: Directory) {
  if (dir.exists) dir.delete();
  dir.create({ intermediates: true });
}

/** Page images of a document in order, or null if they haven't been created yet. */
export function listPages(docId: string): PageImage[] | null {
  const file = manifestFile(docId);
  if (!file.exists) return null;
  const manifest = JSON.parse(file.textSync()) as Manifest;
  const dir = pagesDir(docId);
  return manifest.pages.map((p) => ({ uri: new File(dir, p.file).uri, width: p.width, height: p.height }));
}

/** Rotates and downsizes an image to a page-sized JPEG in the cache. */
export async function normalizeImage(source: { uri: string; rotation: Rotation }) {
  const context = ImageManipulator.manipulate(source.uri, { maxWidth: MAX_PAGE_PX, maxHeight: MAX_PAGE_PX });
  if (source.rotation) context.rotate(source.rotation);
  const image = await context.renderAsync();
  return image.saveAsync({ format: SaveFormat.JPEG, compress: PAGE_QUALITY });
}

/**
 * Rotates and downsizes one scanned page, writes it as the document's page `index`,
 * and returns it with its JPEG bytes for the PDF builder.
 */
export async function writePage(docId: string, index: number, source: { uri: string; rotation: Rotation }) {
  const saved = await normalizeImage(source);
  const dir = pagesDir(docId);
  dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, pageFileName(index));
  await new File(saved.uri).move(target, { overwrite: true });

  return { uri: target.uri, width: saved.width, height: saved.height, bytes: await target.bytes() };
}

export function finishPages(docId: string, pages: { width: number; height: number }[]) {
  writeManifest(docId, { pages: pages.map((p, i) => ({ file: pageFileName(i), width: p.width, height: p.height })) });
}

function oldThumbs(docId: string): File[] {
  const root = thumbsRoot();
  if (!root.exists) return [];
  return root.list().filter((f): f is File => f instanceof File && f.name.startsWith(`${docId}-`));
}

/**
 * Small JPEG for the document list. Returns its file:// URI. Each version gets a new name
 * so image caches never show an outdated thumbnail after an edit.
 */
export async function makeThumb(docId: string, sourceUri: string): Promise<string> {
  const image = await ImageManipulator.manipulate(sourceUri, { maxWidth: THUMB_WIDTH * 2 })
    .resize({ width: THUMB_WIDTH })
    .renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
  const previous = oldThumbs(docId);
  const root = thumbsRoot();
  root.create({ intermediates: true, idempotent: true });
  const target = new File(root, `${docId}-${Date.now()}.jpg`);
  await new File(saved.uri).move(target, { overwrite: true });
  previous.forEach((f) => f.delete());
  return target.uri;
}

/** Thumbnail from page 1 of a PDF (file:// or content://). */
export async function makePdfThumb(docId: string, pdfUri: string): Promise<string> {
  const rendered = await PdfThumbnail.generate(pdfUri, 0, { quality: 80, maxWidth: THUMB_WIDTH * 2 });
  try {
    return await makeThumb(docId, rendered.uri);
  } finally {
    new File(rendered.uri).delete();
  }
}

function friendlyRenderError(e: unknown): Error {
  const code = (e as { code?: string } | null)?.code;
  if (code === PdfThumbnailErrorCodes.PASSWORD_PROTECTED) {
    return new Error('This PDF is password protected, so its pages can’t be shown. You can still share it.');
  }
  if (code === PdfThumbnailErrorCodes.INVALID_FILE) return new Error('This PDF looks damaged and can’t be shown.');
  if (code === PdfThumbnailErrorCodes.OUT_OF_MEMORY) return new Error('This PDF is too large to show on this phone.');
  return e instanceof Error ? e : new Error(String(e));
}

/**
 * Page images for viewing. Scanned documents already have them; imported files are
 * rendered once from the phone copy and cached in the document's pages folder.
 */
export async function ensurePages(doc: Doc): Promise<PageImage[]> {
  const existing = listPages(doc.id);
  if (existing) return existing;
  if (!doc.localUri) throw new Error('This document is only on Google Drive. Download it to view the pages.');

  const dir = pagesDir(doc.id);
  resetDir(dir);
  const pages: { width: number; height: number }[] = [];

  if (doc.kind === 'pdf') {
    let rendered;
    try {
      rendered = await PdfThumbnail.generateAllPages(doc.localUri, { quality: 85, maxWidth: RENDER_WIDTH });
    } catch (e) {
      dir.delete();
      throw friendlyRenderError(e);
    }
    for (const [i, page] of rendered.entries()) {
      await new File(page.uri).move(new File(dir, pageFileName(i)), { overwrite: true });
      pages.push({ width: page.width, height: page.height });
    }
  } else {
    const cached = await MediaStore.copyToCacheAsync(doc.localUri, `${doc.id}.jpg`);
    const page = await writePage(doc.id, 0, { uri: cached, rotation: 0 });
    new File(cached).delete();
    pages.push(page);
  }

  finishPages(doc.id, pages);
  return listPages(doc.id) ?? [];
}

/** Drops the rendered pages so they are re-rendered from the (changed) PDF next time. */
export function clearPageCache(docId: string) {
  const dir = pagesDir(docId);
  if (dir.exists) dir.delete();
}

export function deletePageFiles(docId: string) {
  clearPageCache(docId);
  oldThumbs(docId).forEach((f) => f.delete());
  // Thumbnails from before versioned names.
  const legacy = new File(thumbsRoot(), `${docId}.jpg`);
  if (legacy.exists) legacy.delete();
}
