import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { PDFDocument } from 'pdf-lib';

import MediaStore from '@modules/media-store';
import { deleteDocumentRow, insertDocument, updateDocument } from '@/db/documents';
import type { Doc } from '@/db/schema';
import { safeFileName, titleFromFileName } from '@/lib/documents';
import type { DraftPage } from '@/lib/draftPages';
import { newId } from '@/lib/id';
import { createPdfBuilder } from '@/pdf/build';
import { clearDraftFiles } from '@/scan/scanner';
import type { PageSize } from '@/store/settings';

import { deletePageFiles, finishPages, makePdfThumb, makeThumb, writePage } from './pageStore';

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

    const pdfFile = new File(Paths.cache, `${id}.pdf`);
    pdfFile.create({ overwrite: true });
    pdfFile.writeSync(await builder.save());
    const saved = await MediaStore.saveToDocumentsAsync(pdfFile.uri, safeFileName(finalTitle, 'pdf'), MIME.pdf);
    pdfFile.delete();

    const thumbPath = await makeThumb(id, written[0].uri).catch(() => null);
    const now = Date.now();
    await insertDocument({
      id,
      title: finalTitle,
      kind: 'pdf',
      pageCount: written.length,
      sizeBytes: saved.size,
      createdAt: now,
      updatedAt: now,
      localUri: saved.uri,
      driveFileId: null,
      syncState: 'local_only',
      thumbPath,
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
