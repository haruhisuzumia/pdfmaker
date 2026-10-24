import { describe, expect, it } from '@jest/globals';

import type { DriveFile } from './client';
import { planReconcile, type LocalDoc } from './reconcile';

const doc = (over: Partial<LocalDoc> & Pick<LocalDoc, 'id'>): LocalDoc => ({
  title: over.id,
  syncState: 'local_only',
  driveFileId: null,
  localUri: `content://${over.id}`,
  sizeBytes: 100,
  ...over,
});

const file = (over: Partial<DriveFile> & Pick<DriveFile, 'id'>): DriveFile => ({
  name: `${over.id}.pdf`,
  size: '100',
  modifiedTime: '2026-10-18T10:00:00.000Z',
  ...over,
});

describe('planReconcile', () => {
  it('adds Drive files that are not in the list', () => {
    expect(planReconcile([], [file({ id: 'f1', name: 'Rent agreement.pdf', size: '2048' })])).toEqual([
      {
        type: 'addDriveOnly',
        fileId: 'f1',
        title: 'Rent agreement',
        sizeBytes: 2048,
        modifiedAt: Date.parse('2026-10-18T10:00:00.000Z'),
      },
    ]);
  });

  it('leaves phone-only and matching documents alone', () => {
    const local = [doc({ id: 'a' }), doc({ id: 'b', syncState: 'synced', driveFileId: 'f2' })];
    expect(planReconcile(local, [file({ id: 'f2' })])).toEqual([]);
  });

  it('handles a Drive copy deleted elsewhere, by state', () => {
    const local = [
      doc({ id: 'synced', syncState: 'synced', driveFileId: 'gone1' }),
      doc({ id: 'cloud', syncState: 'drive_only', driveFileId: 'gone2', localUri: null }),
      doc({ id: 'updating', syncState: 'pending_upload', driveFileId: 'gone3' }),
    ];
    expect(planReconcile(local, [])).toEqual([
      { type: 'driveGone', docId: 'synced', next: 'local_only' },
      { type: 'driveGone', docId: 'cloud', next: 'remove' },
      { type: 'driveGone', docId: 'updating', next: 'reupload' },
    ]);
  });

  it('links a document to its Drive file by the app id stored on Drive', () => {
    const local = [doc({ id: 'a', syncState: 'uploading' })];
    expect(planReconcile(local, [file({ id: 'f9', appProperties: { pdfmakerId: 'a' } })])).toEqual([
      { type: 'link', docId: 'a', fileId: 'f9' },
    ]);
  });

  it('replaces a stale Drive id instead of reporting the file as gone', () => {
    const local = [doc({ id: 'a', syncState: 'synced', driveFileId: 'old' })];
    expect(planReconcile(local, [file({ id: 'new', appProperties: { pdfmakerId: 'a' } })])).toEqual([
      { type: 'link', docId: 'a', fileId: 'new' },
    ]);
  });

  it('updates the name and size of Drive-only documents changed on Drive', () => {
    const local = [doc({ id: 'c', title: 'Old', syncState: 'drive_only', driveFileId: 'f3', localUri: null })];
    expect(planReconcile(local, [file({ id: 'f3', name: 'New.pdf', size: '500' })])).toEqual([
      { type: 'updateDriveOnly', docId: 'c', title: 'New', sizeBytes: 500 },
    ]);
  });
});
