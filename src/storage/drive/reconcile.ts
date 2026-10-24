import type { Doc } from '@/db/schema';
import { titleFromFileName } from '@/lib/documents';

import type { DriveFile } from './client';

export type LocalDoc = Pick<Doc, 'id' | 'title' | 'syncState' | 'driveFileId' | 'localUri' | 'sizeBytes'>;

export type ReconcileAction =
  /** A file in the Drive folder that isn't in the list yet (e.g. after reinstalling). */
  | { type: 'addDriveOnly'; fileId: string; title: string; sizeBytes: number; modifiedAt: number }
  /** Our document matches a Drive file we hadn't linked (e.g. the app stopped mid-upload). */
  | { type: 'link'; docId: string; fileId: string }
  /** The Drive copy was deleted elsewhere. */
  | { type: 'driveGone'; docId: string; next: 'local_only' | 'remove' | 'reupload' }
  /** A Drive-only document was renamed or replaced on Drive. */
  | { type: 'updateDriveOnly'; docId: string; title: string; sizeBytes: number };

const sizeOf = (file: DriveFile) => Number(file.size ?? 0);

/** Compares the local list with the Drive folder and returns what should change locally. */
export function planReconcile(local: readonly LocalDoc[], drive: readonly DriveFile[]): ReconcileAction[] {
  const actions: ReconcileAction[] = [];
  const byFileId = new Map(local.filter((d) => d.driveFileId).map((d) => [d.driveFileId!, d]));
  const byId = new Map(local.map((d) => [d.id, d]));
  const seenFileIds = new Set<string>();

  for (const file of drive) {
    seenFileIds.add(file.id);
    const doc = byFileId.get(file.id) ?? (file.appProperties?.pdfmakerId ? byId.get(file.appProperties.pdfmakerId) : undefined);

    if (!doc) {
      actions.push({
        type: 'addDriveOnly',
        fileId: file.id,
        title: titleFromFileName(file.name),
        sizeBytes: sizeOf(file),
        modifiedAt: file.modifiedTime ? Date.parse(file.modifiedTime) : Date.now(),
      });
    } else if (doc.driveFileId !== file.id) {
      actions.push({ type: 'link', docId: doc.id, fileId: file.id });
    } else if (doc.syncState === 'drive_only') {
      const title = titleFromFileName(file.name);
      if (title !== doc.title || sizeOf(file) !== doc.sizeBytes) {
        actions.push({ type: 'updateDriveOnly', docId: doc.id, title, sizeBytes: sizeOf(file) });
      }
    }
  }

  for (const doc of local) {
    if (!doc.driveFileId || seenFileIds.has(doc.driveFileId)) continue;
    // A link found above by pdfmakerId replaces the stale id; no need to treat it as gone.
    if (actions.some((a) => a.type === 'link' && a.docId === doc.id)) continue;

    if (doc.syncState === 'drive_only') actions.push({ type: 'driveGone', docId: doc.id, next: 'remove' });
    else if (doc.syncState === 'pending_upload' || doc.syncState === 'uploading' || doc.syncState === 'error') {
      actions.push({ type: 'driveGone', docId: doc.id, next: 'reupload' });
    } else actions.push({ type: 'driveGone', docId: doc.id, next: 'local_only' });
  }

  return actions;
}
