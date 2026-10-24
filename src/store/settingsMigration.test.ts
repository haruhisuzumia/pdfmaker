import { describe, expect, it } from '@jest/globals';

import { migrateSettings } from './settingsMigration';

describe('migrateSettings', () => {
  it('adds the Drive fields and maps the old drive-only location to both', () => {
    expect(migrateSettings({ onboarded: true, saveLocation: 'drive', theme: 'dark' }, 1)).toEqual({
      onboarded: true,
      saveLocation: 'both',
      theme: 'dark',
      driveEmail: null,
      driveFolderId: null,
    });
  });

  it('keeps current settings untouched', () => {
    const v2 = { saveLocation: 'phone', driveEmail: 'a@b.c', driveFolderId: 'f' };
    expect(migrateSettings(v2, 2)).toEqual(v2);
  });
});
