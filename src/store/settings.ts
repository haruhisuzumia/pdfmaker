import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { migrateSettings, SETTINGS_VERSION } from './settingsMigration';

/** "both" keeps the phone copy and also uploads to Google Drive. */
export type SaveLocation = 'phone' | 'both';
export type ThemePreference = 'system' | 'light' | 'dark';
export type PageSize = 'a4' | 'letter' | 'fit';

type SettingsState = {
  onboarded: boolean;
  saveLocation: SaveLocation;
  wifiOnlyUploads: boolean;
  pageSize: PageSize;
  theme: ThemePreference;
  appLock: boolean;
  /** The connected Google account, or null when Drive isn't connected. */
  driveEmail: string | null;
  driveFolderId: string | null;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
};

// Synchronous storage so settings are ready on the first render (no onboarding flash).
const syncStorage: StateStorage = {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      onboarded: false,
      saveLocation: 'phone',
      wifiOnlyUploads: true,
      pageSize: 'a4',
      theme: 'system',
      appLock: false,
      driveEmail: null,
      driveFolderId: null,
      set: (patch) => set(patch),
    }),
    {
      name: 'settings',
      version: SETTINGS_VERSION,
      migrate: (persisted, version) => migrateSettings(persisted, version) as unknown as SettingsState,
      storage: createJSONStorage(() => syncStorage),
      partialize: ({ set: _set, ...rest }) => rest,
    },
  ),
);
