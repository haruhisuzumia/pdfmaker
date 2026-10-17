import type { Doc, SyncState } from '@/db/schema';

export type LocationFilter = 'all' | 'phone' | 'drive';
export type SortKey = 'date' | 'name' | 'size';

export type Badge = 'phone' | 'drive' | 'both' | 'uploading' | 'error';

/** Which badge a document shows in the list. */
export function badgeFor(state: SyncState): Badge {
  switch (state) {
    case 'local_only':
      return 'phone';
    case 'drive_only':
      return 'drive';
    case 'synced':
      return 'both';
    case 'pending_upload':
    case 'uploading':
      return 'uploading';
    case 'error':
      return 'error';
  }
}

export function isOnPhone(doc: Pick<Doc, 'localUri'>) {
  return doc.localUri != null;
}

export function isOnDrive(doc: Pick<Doc, 'syncState'>) {
  return doc.syncState === 'synced' || doc.syncState === 'drive_only';
}

export function filterDocs<T extends Pick<Doc, 'title' | 'localUri' | 'syncState'>>(
  docs: readonly T[],
  location: LocationFilter,
  search: string,
): T[] {
  const needle = search.trim().toLocaleLowerCase();
  return docs.filter((doc) => {
    if (location === 'phone' && !isOnPhone(doc)) return false;
    if (location === 'drive' && !isOnDrive(doc)) return false;
    return needle === '' || doc.title.toLocaleLowerCase().includes(needle);
  });
}

export function sortDocs<T extends Pick<Doc, 'title' | 'updatedAt' | 'sizeBytes'>>(docs: readonly T[], key: SortKey): T[] {
  const sorted = [...docs];
  switch (key) {
    case 'date':
      return sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    case 'name':
      return sorted.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
    case 'size':
      return sorted.sort((a, b) => b.sizeBytes - a.sizeBytes);
  }
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Today", "Yesterday", "12 Oct" or "12 Oct 2025" for other years. */
export function formatDocDate(timestamp: number, now: number = Date.now()): string {
  const date = new Date(timestamp);
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  if (timestamp >= startOfToday) return 'Today';
  if (timestamp >= startOfToday - dayMs) return 'Yesterday';

  const base = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === today.getFullYear() ? base : `${base} ${date.getFullYear()}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Default title for a new scan, e.g. "Scan 17 Oct 2026 10-32" (no ":" so it is a valid file name). */
export function defaultScanTitle(at: Date = new Date()): string {
  return `Scan ${at.getDate()} ${MONTHS[at.getMonth()]} ${at.getFullYear()} ${pad(at.getHours())}-${pad(at.getMinutes())}`;
}

/** Strips characters Android file names can't contain and trims the length. */
export function safeFileName(title: string, extension: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  return `${cleaned || 'Document'}.${extension}`;
}

/** Title for an imported file: its name without the extension. */
export function titleFromFileName(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^./]+$/, '').trim();
  return withoutExt || 'Document';
}
