import { Directory, File, Paths } from 'expo-file-system';

import DocumentScanner from '@modules/document-scanner';
import type { DraftPage } from '@/lib/draftPages';
import { newId } from '@/lib/id';

/** Only one scan is reviewed at a time, so the draft lives in a single cache folder. */
const draftDir = () => new Directory(Paths.cache, 'draft');

/**
 * Opens Google's ML Kit scanner (edge detection, perspective correction, filters, cleanup)
 * and copies the scanned pages into the draft folder. Returns null if the user backs out.
 */
export async function scanPages({ pageLimit = 50 }: { pageLimit?: number } = {}): Promise<DraftPage[] | null> {
  let uris: string[] | null;
  try {
    uris = await DocumentScanner.scanAsync({ pageLimit, galleryImportAllowed: true });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Could not open the scanner. It needs Google Play services. Update it from the Play Store and try again. (${detail})`,
    );
  }
  if (!uris?.length) return null;

  const dir = draftDir();
  dir.create({ intermediates: true, idempotent: true });

  return Promise.all(
    uris.map(async (uri) => {
      const id = newId();
      const target = new File(dir, `${id}.jpg`);
      await new File(uri).copy(target);
      return { id, uri: target.uri, rotation: 0 } satisfies DraftPage;
    }),
  );
}

export function clearDraftFiles() {
  const dir = draftDir();
  if (dir.exists) dir.delete();
}
