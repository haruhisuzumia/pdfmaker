import { desc, eq } from 'drizzle-orm';

import { db } from './client';
import { documents, type Doc, type NewDoc } from './schema';

export function allDocumentsQuery() {
  return db.select().from(documents).orderBy(desc(documents.updatedAt));
}

export function documentByIdQuery(id: string) {
  return db.select().from(documents).where(eq(documents.id, id)).limit(1);
}

export async function insertDocument(doc: NewDoc) {
  await db.insert(documents).values(doc);
}

export async function updateDocument(id: string, patch: Partial<Omit<Doc, 'id'>>) {
  await db
    .update(documents)
    .set({ ...patch, updatedAt: Date.now() })
    .where(eq(documents.id, id));
}

export async function deleteDocumentRow(id: string) {
  await db.delete(documents).where(eq(documents.id, id));
}
