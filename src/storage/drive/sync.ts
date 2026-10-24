import NetInfo from '@react-native-community/netinfo';
import { eq, inArray } from 'drizzle-orm';
import { File, Paths } from 'expo-file-system';

import MediaStore from '@modules/media-store';
import { db } from '@/db/client';
import { deleteDocumentRow, insertDocument, updateDocument } from '@/db/documents';
import { documents, type Doc, type SyncState } from '@/db/schema';
import { safeFileName } from '@/lib/documents';
import { newId } from '@/lib/id';
import { countPages } from '@/pdf/edit';
import { useSettings } from '@/store/settings';

import { deletePageFiles, makePdfThumb } from '../pageStore';
import {
  downloadFile,
  ensureFolder,
  getToken,
  getUserEmail,
  listFolder,
  renameFile,
  replaceFileContent,
  revokeAccess,
  trashFile,
  uploadNewFile,
} from './client';
import { planReconcile } from './reconcile';

export const isDriveConnected = () => useSettings.getState().driveEmail != null;

/** Sync bookkeeping doesn't count as an edit, so it leaves updatedAt (list order) alone. */
async function setSync(docId: string, patch: Partial<Pick<Doc, 'syncState' | 'driveFileId'>>) {
  await db.update(documents).set(patch).where(eq(documents.id, docId));
}

/** State for a newly saved document: queued for Drive when the user chose "Phone + Drive". */
export function initialSyncState(): SyncState {
  const { driveEmail, saveLocation } = useSettings.getState();
  return driveEmail && saveLocation === 'both' ? 'pending_upload' : 'local_only';
}

async function canUseNetwork(): Promise<boolean> {
  const state = await NetInfo.fetch();
  if (!state.isConnected || state.isInternetReachable === false) return false;
  return !useSettings.getState().wifiOnlyUploads || state.type === 'wifi';
}

async function folderId(): Promise<string> {
  const settings = useSettings.getState();
  const id = await ensureFolder(settings.driveFolderId);
  if (id !== settings.driveFolderId) settings.set({ driveFolderId: id });
  return id;
}

/** Connects Google Drive (shows Google's sign-in). Returns the email, or null if cancelled. */
export async function connectDrive(): Promise<string | null> {
  const token = await getToken({ interactive: true });
  if (!token) return null;
  const email = await getUserEmail();
  useSettings.getState().set({ driveEmail: email, saveLocation: 'both' });
  await folderId();
  void syncNow();
  return email;
}

/**
 * Disconnects Drive: the app's access is revoked, Drive-only entries leave the list and every
 * document becomes phone-only. Files already on Drive stay there.
 */
export async function disconnectDrive() {
  await revokeAccess();
  const all = await db.select().from(documents);
  for (const doc of all) {
    if (!doc.localUri) {
      await deleteDocumentRow(doc.id);
      deletePageFiles(doc.id);
    } else if (doc.driveFileId || doc.syncState !== 'local_only') {
      await setSync(doc.id, { syncState: 'local_only', driveFileId: null });
    }
  }
  useSettings.getState().set({ driveEmail: null, driveFolderId: null, saveLocation: 'phone' });
}

let queue: Promise<void> | null = null;

/** Uploads every queued document, one at a time. Safe to call often; runs once at a time. */
export function runUploadQueue(): Promise<void> {
  queue ??= uploadPending().finally(() => {
    queue = null;
  });
  return queue;
}

async function uploadPending() {
  if (!isDriveConnected() || !(await canUseNetwork())) return;
  const parent = await folderId();
  const pending = await db
    .select()
    .from(documents)
    .where(inArray(documents.syncState, ['pending_upload', 'uploading']));

  for (const doc of pending) {
    if (!doc.localUri) continue;
    await setSync(doc.id, { syncState: 'uploading' });
    const cached = new File(await MediaStore.copyToCacheAsync(doc.localUri, `${doc.id}-upload.pdf`));
    try {
      const name = safeFileName(doc.title, 'pdf');
      const uploaded = doc.driveFileId
        ? await replaceFileContent(doc.driveFileId, cached.uri, name)
        : await uploadNewFile(cached.uri, { name, folderId: parent, docId: doc.id });
      await setSync(doc.id, { syncState: 'synced', driveFileId: uploaded.id });
    } catch {
      await setSync(doc.id, { syncState: 'error' });
    } finally {
      cached.delete();
    }
  }
}

/** Brings the list in line with the Drive folder (files added or deleted elsewhere). */
export async function reconcile() {
  if (!isDriveConnected() || !(await canUseNetwork())) return;
  const files = await listFolder(await folderId());
  const local = await db.select().from(documents);

  for (const action of planReconcile(local, files)) {
    switch (action.type) {
      case 'addDriveOnly':
        await insertDocument({
          id: newId(),
          title: action.title,
          kind: 'pdf',
          pageCount: 0,
          sizeBytes: action.sizeBytes,
          createdAt: action.modifiedAt,
          updatedAt: action.modifiedAt,
          localUri: null,
          driveFileId: action.fileId,
          syncState: 'drive_only',
          thumbPath: null,
        });
        break;
      case 'link': {
        const doc = local.find((d) => d.id === action.docId)!;
        await setSync(action.docId, { driveFileId: action.fileId, syncState: doc.localUri ? 'synced' : 'drive_only' });
        break;
      }
      case 'updateDriveOnly':
        await updateDocument(action.docId, { title: action.title, sizeBytes: action.sizeBytes });
        break;
      case 'driveGone':
        if (action.next === 'remove') {
          await deleteDocumentRow(action.docId);
          deletePageFiles(action.docId);
        } else {
          await setSync(action.docId, {
            driveFileId: null,
            syncState: action.next === 'reupload' ? 'pending_upload' : 'local_only',
          });
        }
        break;
    }
  }
}

/** Upload what's queued, then pick up changes made on Drive. Errors are left for the next run. */
export async function syncNow() {
  await runUploadQueue().catch(() => {});
  await reconcile().catch(() => {});
  await runUploadQueue().catch(() => {});
}

/** Queues a document for Drive and starts uploading in the background. */
export async function queueUpload(doc: Pick<Doc, 'id'>) {
  await setSync(doc.id, { syncState: 'pending_upload' });
  void runUploadQueue().catch(() => {});
}

/** Downloads a Drive-only document to Documents/Panna so it can be opened offline. */
export async function downloadDocument(doc: Doc) {
  if (!doc.driveFileId) throw new Error('This document is not on Google Drive.');
  const temp = new File(Paths.cache, `${doc.id}-download.pdf`);
  try {
    await downloadFile(doc.driveFileId, temp);
    const saved = await MediaStore.saveToDocumentsAsync(temp.uri, safeFileName(doc.title, 'pdf'), 'application/pdf');
    const pageCount = await countPages(await temp.bytes()).catch(() => 0);
    const thumbPath = await makePdfThumb(doc.id, temp.uri).catch(() => null);
    await db
      .update(documents)
      .set({ localUri: saved.uri, syncState: 'synced', sizeBytes: saved.size, pageCount, thumbPath })
      .where(eq(documents.id, doc.id));
  } finally {
    if (temp.exists) temp.delete();
  }
}

/** Moves a document's Drive copy (if any) to Drive's Bin. */
export async function trashDriveCopy(doc: Pick<Doc, 'driveFileId'>) {
  if (doc.driveFileId) await trashFile(doc.driveFileId);
}

/** Moves the Drive copy to Drive's Bin and keeps the phone copy (or drops the entry if there is none). */
export async function removeFromDrive(doc: Doc) {
  if (doc.driveFileId) await trashFile(doc.driveFileId);
  if (doc.localUri) {
    await setSync(doc.id, { driveFileId: null, syncState: 'local_only' });
  } else {
    await deleteDocumentRow(doc.id);
    deletePageFiles(doc.id);
  }
}

/** Keeps the Drive file name in step with a rename; failures are retried on the next upload. */
export async function renameOnDrive(doc: Pick<Doc, 'driveFileId'>, title: string) {
  if (!doc.driveFileId || !isDriveConnected()) return;
  await renameFile(doc.driveFileId, safeFileName(title, 'pdf')).catch(() => {});
}
