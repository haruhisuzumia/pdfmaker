import { describe, expect, it } from '@jest/globals';

import type { SyncState } from '@/db/schema';

import { badgeFor, defaultScanTitle, filterDocs, formatDocDate, formatSize, safeFileName, sortDocs, titleFromFileName } from './documents';

type Row = { title: string; localUri: string | null; syncState: SyncState; updatedAt: number; sizeBytes: number };

const row = (title: string, localUri: string | null, syncState: SyncState, updatedAt = 0, sizeBytes = 0): Row => ({
  title,
  localUri,
  syncState,
  updatedAt,
  sizeBytes,
});

describe('badgeFor', () => {
  it.each<[SyncState, string]>([
    ['local_only', 'phone'],
    ['drive_only', 'drive'],
    ['synced', 'both'],
    ['pending_upload', 'uploading'],
    ['uploading', 'uploading'],
    ['error', 'error'],
  ])('%s → %s', (state, badge) => {
    expect(badgeFor(state)).toBe(badge);
  });
});

describe('filterDocs', () => {
  const docs = [
    row('Aadhaar Card', 'content://1', 'local_only'),
    row('Rent Agreement', null, 'drive_only'),
    row('Marksheet', 'content://3', 'synced'),
    row('Exam Form', 'content://4', 'pending_upload'),
  ];

  it('phone shows everything with a local copy', () => {
    expect(filterDocs(docs, 'phone', '').map((d) => d.title)).toEqual(['Aadhaar Card', 'Marksheet', 'Exam Form']);
  });

  it('drive shows only documents already on Drive', () => {
    expect(filterDocs(docs, 'drive', '').map((d) => d.title)).toEqual(['Rent Agreement', 'Marksheet']);
  });

  it('search is case-insensitive and trims whitespace', () => {
    expect(filterDocs(docs, 'all', '  aadhaar ').map((d) => d.title)).toEqual(['Aadhaar Card']);
  });
});

describe('sortDocs', () => {
  const docs = [row('Scan 10', null, 'local_only', 1, 500), row('scan 2', null, 'local_only', 3, 100), row('B', null, 'local_only', 2, 900)];

  it('date sorts newest first', () => {
    expect(sortDocs(docs, 'date').map((d) => d.title)).toEqual(['scan 2', 'B', 'Scan 10']);
  });

  it('name sorts naturally, ignoring case', () => {
    expect(sortDocs(docs, 'name').map((d) => d.title)).toEqual(['B', 'scan 2', 'Scan 10']);
  });

  it('size sorts largest first and does not mutate the input', () => {
    expect(sortDocs(docs, 'size').map((d) => d.title)).toEqual(['B', 'Scan 10', 'scan 2']);
    expect(docs[0].title).toBe('Scan 10');
  });
});

describe('formatting', () => {
  it('formatSize', () => {
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(48 * 1024)).toBe('48 KB');
    expect(formatSize(1.25 * 1024 * 1024)).toBe('1.3 MB');
  });

  it('formatDocDate', () => {
    const now = new Date(2026, 9, 17, 15, 0).getTime();
    expect(formatDocDate(new Date(2026, 9, 17, 9, 0).getTime(), now)).toBe('Today');
    expect(formatDocDate(new Date(2026, 9, 16, 23, 59).getTime(), now)).toBe('Yesterday');
    expect(formatDocDate(new Date(2026, 9, 12).getTime(), now)).toBe('12 Oct');
    expect(formatDocDate(new Date(2025, 0, 3).getTime(), now)).toBe('3 Jan 2025');
  });

  it('defaultScanTitle has no characters that are invalid in file names', () => {
    expect(defaultScanTitle(new Date(2026, 9, 17, 9, 5))).toBe('Scan 17 Oct 2026 09-05');
  });

  it('safeFileName strips reserved characters', () => {
    expect(safeFileName('Rent: April/May?', 'pdf')).toBe('Rent April May.pdf');
    expect(safeFileName('   ', 'jpg')).toBe('Document.jpg');
  });

  it('titleFromFileName drops the extension', () => {
    expect(titleFromFileName('Aadhaar.Card.pdf')).toBe('Aadhaar.Card');
    expect(titleFromFileName('.pdf')).toBe('Document');
  });
});
