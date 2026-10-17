import { Directory, File, Paths } from 'expo-file-system';
import { launchImageLibraryAsync } from 'expo-image-picker';

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
  return copyIntoDraft(uris);
}

/** Lets the user pick photos (Android photo picker, no permission needed), in the order they tap them. */
export async function pickImages(): Promise<DraftPage[] | null> {
  const result = await launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    orderedSelection: true,
    selectionLimit: 50,
    quality: 1,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return copyIntoDraft(result.assets.map((a) => a.uri));
}

async function copyIntoDraft(uris: string[]): Promise<DraftPage[]> {
  const dir = draftDir();
  dir.create({ intermediates: true, idempotent: true });

  return Promise.all(
    uris.map(async (uri) => {
      const id = newId();
      // Keep the extension: pages are re-encoded to JPEG when saved, but HEIC/PNG previews need the right type.
      const ext = /\.(\w{3,4})(?:\?.*)?$/.exec(uri)?.[1]?.toLowerCase() ?? 'jpg';
      const target = new File(dir, `${id}.${ext}`);
      await new File(uri).copy(target);
      return { id, uri: target.uri, rotation: 0, source: { kind: 'image' } } satisfies DraftPage;
    }),
  );
}

export function clearDraftFiles() {
  const dir = draftDir();
  if (dir.exists) dir.delete();
}
