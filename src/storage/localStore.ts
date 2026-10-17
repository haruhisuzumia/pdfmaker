import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { PDFDocument } from 'pdf-lib';
import PdfThumbnail from 'react-native-pdf-thumbnail';

import MediaStore from '@modules/media-store';
import { deleteDocumentRow, insertDocument, updateDocument } from '@/db/documents';
import type { Doc } from '@/db/schema';
import { safeFileName, titleFromFileName } from '@/lib/documents';
import type { DraftPage } from '@/lib/draftPages';
import { newId } from '@/lib/id';
import { createPdfBuilder } from '@/pdf/build';
import { countPages, extractPages, mergePdfs, rebuildPdf, type EditPage } from '@/pdf/edit';
import { clearDraftFiles } from '@/scan/scanner';
import type { PageSize } from '@/store/settings';

import {
  clearPageCache,
  deletePageFiles,
  finishPages,
  makePdfThumb,
  makeThumb,
  normalizeImage,
  writePage,
} from './pageStore';

const MIME = { pdf: 'application/pdf', jpg: 'image/jpeg' } as const;

async function countPdfPages(uri: string): Promise<number> {
  try {
    const pdf = await PDFDocument.load(await new File(uri).bytes(), { ignoreEncryption: true, updateMetadata: false });
    return pdf.getPageCount();
  } catch {
    // Damaged or unusual PDFs still import; the page count just stays unknown.
    return 0;
  }
}

/**
 * Lets the user pick PDFs (from the phone or the Google Drive provider in the system picker),
 * copies each into Documents/PDF Maker and adds it to the list. Returns how many were imported.
 */
export async function importPdfs(): Promise<number> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: MIME.pdf,
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (picked.canceled) return 0;

  for (const asset of picked.assets) {
    const id = newId();
    const title = titleFromFileName(asset.name);
    const pageCount = await countPdfPages(asset.uri);
    const saved = await MediaStore.saveToDocumentsAsync(asset.uri, safeFileName(title, 'pdf'), MIME.pdf);
    // A missing thumbnail should never block an import.
    const thumbPath = await makePdfThumb(id, asset.uri).catch(() => null);
    const now = Date.now();

    await insertDocument({
      id,
      title,
      kind: 'pdf',
      pageCount,
      sizeBytes: saved.size || asset.size || 0,
      createdAt: now,
      updatedAt: now,
      localUri: saved.uri,
      driveFileId: null,
      syncState: 'local_only',
      thumbPath,
    });
    new File(asset.uri).delete();
  }
  return picked.assets.length;
}

/** Writes PDF bytes to a temporary file; the caller deletes it. */
function writeTempPdf(name: string, bytes: Uint8Array): File {
  const file = new File(Paths.cache, `${name}.pdf`);
  file.create({ overwrite: true });
  file.writeSync(bytes);
  return file;
}

/** Saves a finished PDF to Documents/PDF Maker, makes its thumbnail and adds it to the list. */
async function saveNewPdf(
  id: string,
  bytes: Uint8Array,
  { title, pageCount, thumb }: { title: string; pageCount: number; thumb?: { kind: 'image' | 'pdf'; uri: string } },
) {
  const temp = writeTempPdf(id, bytes);
  try {
    const saved = await MediaStore.saveToDocumentsAsync(temp.uri, safeFileName(title, 'pdf'), MIME.pdf);
    const thumbSource = thumb ?? { kind: 'pdf', uri: temp.uri };
    const thumbPath = await (thumbSource.kind === 'image' ? makeThumb(id, thumbSource.uri) : makePdfThumb(id, thumbSource.uri)).catch(
      () => null,
    );
    const now = Date.now();
    await insertDocument({
      id,
      title,
      kind: 'pdf',
      pageCount,
      sizeBytes: saved.size,
      createdAt: now,
      updatedAt: now,
      localUri: saved.uri,
      driveFileId: null,
      syncState: 'local_only',
      thumbPath,
    });
  } finally {
    temp.delete();
  }
}

/** The document's PDF bytes (copied out of shared storage). */
async function readPdfBytes(doc: Doc): Promise<Uint8Array> {
  if (!doc.localUri) throw new Error('This document is only on Google Drive. Download it first.');
  if (doc.kind !== 'pdf') throw new Error('This tool works on PDF documents.');
  const cached = new File(await MediaStore.copyToCacheAsync(doc.localUri, `${doc.id}-${Date.now()}.pdf`));
  try {
    return await cached.bytes();
  } finally {
    cached.delete();
  }
}

/**
 * Turns the reviewed scan into a PDF in Documents/PDF Maker, keeps the page images for
 * viewing, and adds it to the list. Returns the new document id.
 */
export async function saveScannedDocument(
  pages: readonly DraftPage[],
  { title, pageSize, onProgress }: { title: string; pageSize: PageSize; onProgress?: (done: number, total: number) => void },
): Promise<string> {
  if (pages.length === 0) throw new Error('Add at least one page.');
  const id = newId();
  const finalTitle = title.trim() || 'Scan';

  try {
    const builder = await createPdfBuilder(finalTitle, pageSize);
    const written: { uri: string; width: number; height: number }[] = [];
    for (const [i, page] of pages.entries()) {
      onProgress?.(i, pages.length);
      const { bytes, ...image } = await writePage(id, i, page);
      await builder.addJpeg(bytes);
      written.push(image);
    }
    finishPages(id, written);

    await saveNewPdf(id, await builder.save(), {
      title: finalTitle,
      pageCount: written.length,
      thumb: { kind: 'image', uri: written[0].uri },
    });
  } catch (e) {
    deletePageFiles(id);
    throw e;
  }

  clearDraftFiles();
  onProgress?.(pages.length, pages.length);
  return id;
}

export async function shareDocument(doc: Doc) {
  if (!doc.localUri) throw new Error('This document is not on the phone yet.');
  const fileUri = await MediaStore.copyToCacheAsync(doc.localUri, safeFileName(doc.title, doc.kind));
  await Sharing.shareAsync(fileUri, { mimeType: MIME[doc.kind], dialogTitle: doc.title });
}

export async function renameDocument(doc: Doc, title: string) {
  const trimmed = title.trim();
  if (!trimmed || trimmed === doc.title) return;
  await updateDocument(doc.id, { title: trimmed });
}

/**
 * Removes the phone copy. Returns false if the file could not be deleted from the folder
 * (e.g. it was created before a reinstall); the list entry is removed either way.
 */
export async function deleteFromPhone(doc: Doc): Promise<boolean> {
  const removed = doc.localUri ? await MediaStore.deleteAsync(doc.localUri) : true;
  if (doc.syncState === 'synced') {
    await updateDocument(doc.id, { localUri: null, syncState: 'drive_only' });
  } else {
    await deleteDocumentRow(doc.id);
    deletePageFiles(doc.id);
  }
  return removed;
}

/**
 * Applies Edit pages to a saved document. Existing pages are copied from the PDF (keeping text
 * and quality); new pages are embedded images. The file in Documents/PDF Maker is replaced in place.
 * Returns the id of the document that holds the result (a new one if the original can't be changed).
 */
export async function saveEditedDocument(
  doc: Doc,
  pages: readonly DraftPage[],
  { pageSize, onProgress }: { pageSize: PageSize; onProgress?: (done: number, total: number) => void },
): Promise<string> {
  const source = await readPdfBytes(doc);
  const editPages: EditPage[] = [];
  for (const [i, page] of pages.entries()) {
    onProgress?.(i, pages.length);
    if (page.source.kind === 'pdf') {
      editPages.push({ from: 'pdf', index: page.source.index, rotation: page.rotation });
    } else {
      const normalized = new File((await normalizeImage(page)).uri);
      editPages.push({ from: 'image', bytes: await normalized.bytes() });
      normalized.delete();
    }
  }
  const bytes = await rebuildPdf(source, editPages, { title: doc.title, pageSize });
  onProgress?.(pages.length, pages.length);

  const temp = writeTempPdf(`${doc.id}-edit`, bytes);
  try {
    let saved;
    try {
      saved = await MediaStore.overwriteAsync(doc.localUri!, temp.uri);
    } catch (e) {
      if ((e as { code?: string }).code !== 'ERR_MEDIA_STORE_NOT_OWNED') throw e;
      // The original belongs to an earlier install; keep it and save the edit as a new copy.
      const id = newId();
      await saveNewPdf(id, bytes, { title: `${doc.title} (edited)`, pageCount: editPages.length });
      clearDraftFiles();
      return id;
    }

    clearPageCache(doc.id);
    const thumbPath = await makePdfThumb(doc.id, temp.uri).catch(() => doc.thumbPath);
    await updateDocument(doc.id, { pageCount: editPages.length, sizeBytes: saved.size, thumbPath });
  } finally {
    temp.delete();
  }
  clearDraftFiles();
  return doc.id;
}

/** Joins whole documents, in the given order, into a new document. Returns its id. */
export async function mergeDocuments(docs: readonly Doc[], title: string): Promise<string> {
  const sources = [];
  for (const doc of docs) sources.push(await readPdfBytes(doc));
  const bytes = await mergePdfs(sources, title);
  const id = newId();
  await saveNewPdf(id, bytes, { title, pageCount: await countPages(bytes) });
  return id;
}

/** Copies the chosen pages (zero-based) into a new document. Returns its id. */
export async function extractToNewDocument(doc: Doc, indices: readonly number[], title: string): Promise<string> {
  const bytes = await extractPages(await readPdfBytes(doc), indices, title);
  const id = newId();
  await saveNewPdf(id, bytes, { title, pageCount: indices.length });
  return id;
}

/** Saves every page as a JPG in Pictures/PDF Maker (visible in the Gallery). Returns how many. */
export async function exportPagesAsImages(doc: Doc, onProgress?: (done: number, total: number) => void): Promise<number> {
  if (!doc.localUri) throw new Error('This document is only on Google Drive. Download it first.');
  const total = doc.pageCount || (await countPages(await readPdfBytes(doc)));
  for (let i = 0; i < total; i++) {
    onProgress?.(i, total);
    const page = await PdfThumbnail.generate(doc.localUri, i, { quality: 90, maxWidth: 2480 });
    try {
      await MediaStore.saveImageToGalleryAsync(page.uri, safeFileName(`${doc.title} - page ${i + 1}`, 'jpg'));
    } finally {
      new File(page.uri).delete();
    }
  }
  onProgress?.(total, total);
  return total;
}
