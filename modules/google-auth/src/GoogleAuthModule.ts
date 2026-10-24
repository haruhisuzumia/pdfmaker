import { NativeModule, requireNativeModule } from 'expo';

declare class GoogleAuthModule extends NativeModule<{}> {
  /**
   * Gets an OAuth access token for Google Drive (drive.file + email scopes).
   * With `interactive`, shows Google's account and consent screens when needed and resolves null if
   * the user cancels; without it, rejects with ERR_NEEDS_CONSENT instead of showing anything.
   */
  authorizeAsync(interactive: boolean): Promise<string | null>;
}

export default requireNativeModule<GoogleAuthModule>('GoogleAuth');
