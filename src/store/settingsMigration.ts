/** Persisted settings shape changes. Bump SETTINGS_VERSION and add a step for each change. */
export const SETTINGS_VERSION = 2;

type Persisted = Record<string, unknown>;

export function migrateSettings(persisted: unknown, fromVersion: number): Persisted {
  const state: Persisted = { ...((persisted as Persisted) ?? {}) };
  if (fromVersion < 2) {
    // v2: Google Drive. The save location is now "phone" or "both" (a phone copy is always kept).
    if (state.saveLocation === 'drive') state.saveLocation = 'both';
    state.driveEmail ??= null;
    state.driveFolderId ??= null;
  }
  return state;
}
