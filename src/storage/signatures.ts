import { desc, eq } from 'drizzle-orm';
import { Directory, File, Paths } from 'expo-file-system';

import { db } from '@/db/client';
import { signatures } from '@/db/schema';
import { newId } from '@/lib/id';
import type { InkColor, Signature } from '@/lib/signature';

export type SavedSignature = Signature & { id: string; ink: InkColor };

const signaturesDir = () => new Directory(Paths.document, 'signatures');

export function savedSignaturesQuery() {
  return db.select().from(signatures).orderBy(desc(signatures.createdAt));
}

export function loadSignature(row: { id: string; path: string }): SavedSignature | null {
  const file = new File(row.path);
  if (!file.exists) return null;
  return { id: row.id, ...(JSON.parse(file.textSync()) as Signature & { ink: InkColor }) };
}

export async function saveSignature(signature: Signature, ink: InkColor): Promise<SavedSignature> {
  const id = newId();
  const dir = signaturesDir();
  dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, `${id}.json`);
  file.create({ overwrite: true });
  file.writeSync(JSON.stringify({ ...signature, ink }));
  await db.insert(signatures).values({ id, path: file.uri, createdAt: Date.now() });
  return { id, ink, ...signature };
}

export async function deleteSignature(id: string) {
  const [row] = await db.select().from(signatures).where(eq(signatures.id, id));
  if (row) {
    const file = new File(row.path);
    if (file.exists) file.delete();
  }
  await db.delete(signatures).where(eq(signatures.id, id));
}
