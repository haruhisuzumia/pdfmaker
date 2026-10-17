import { int, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Where a document currently lives. Drives the badge in the document list.
 * - local_only: on the phone only
 * - pending_upload / uploading: on the phone, Drive copy on its way
 * - synced: on the phone and on Drive
 * - drive_only: on Drive only (downloaded on demand)
 * - error: last Drive upload failed
 */
export const SYNC_STATES = ['local_only', 'pending_upload', 'uploading', 'synced', 'drive_only', 'error'] as const;
export type SyncState = (typeof SYNC_STATES)[number];

export const DOC_KINDS = ['pdf', 'jpg'] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export const documents = sqliteTable('documents', {
  id: text().primaryKey(),
  title: text().notNull(),
  kind: text({ enum: DOC_KINDS }).notNull(),
  pageCount: int().notNull(),
  sizeBytes: int().notNull(),
  createdAt: int().notNull(),
  updatedAt: int().notNull(),
  /** content:// URI in Documents/PDF Maker, null when the file is only on Drive. */
  localUri: text(),
  driveFileId: text(),
  syncState: text({ enum: SYNC_STATES }).notNull(),
  thumbPath: text(),
});

export const signatures = sqliteTable('signatures', {
  id: text().primaryKey(),
  path: text().notNull(),
  createdAt: int().notNull(),
});

export type Doc = typeof documents.$inferSelect;
export type NewDoc = typeof documents.$inferInsert;
