import { NativeModule, requireNativeModule } from 'expo';

import type { SavedFile } from './MediaStore.types';

declare class MediaStoreModule extends NativeModule<{}> {
  /** Copies `sourceUri` into the shared `Documents/<folder>` directory (default "Panna"). */
  saveToDocumentsAsync(sourceUri: string, displayName: string, mimeType: string, folder?: string | null): Promise<SavedFile>;
  /**
   * Replaces the content of an entry the app created, keeping its name and location.
   * Rejects with ERR_MEDIA_STORE_NOT_OWNED if the app no longer owns it (e.g. after a reinstall).
   */
  overwriteAsync(targetUri: string, sourceUri: string): Promise<SavedFile>;
  /** Saves a JPEG into Pictures/<folder> (default "Panna") so it appears in the Gallery. */
  saveImageToGalleryAsync(sourceUri: string, displayName: string, folder?: string | null): Promise<SavedFile>;
  /** Resolves false if the entry is gone or no longer owned by the app. */
  deleteAsync(uri: string): Promise<boolean>;
  existsAsync(uri: string): Promise<boolean>;
  /** Copies a content:// entry into the app cache and returns its file:// URI. */
  copyToCacheAsync(uri: string, fileName: string): Promise<string>;
}

export default requireNativeModule<MediaStoreModule>('MediaStore');
