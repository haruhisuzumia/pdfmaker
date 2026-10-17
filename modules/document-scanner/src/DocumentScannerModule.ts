import { NativeModule, requireNativeModule } from 'expo';

import type { ScanOptions } from './DocumentScanner.types';

declare class DocumentScannerModule extends NativeModule<{}> {
  /**
   * Opens Google's ML Kit document scanner. Resolves with the scanned page JPEG URIs,
   * or null if the user backs out.
   */
  scanAsync(options: ScanOptions): Promise<string[] | null>;
}

export default requireNativeModule<DocumentScannerModule>('DocumentScanner');
