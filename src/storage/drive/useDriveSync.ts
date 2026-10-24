import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useSettings } from '@/store/settings';

import { runUploadQueue, syncNow } from './sync';

/** While Drive is connected: sync on start and when the app returns, and upload when the network comes back. */
export function useDriveSync() {
  const connected = useSettings((s) => s.driveEmail != null);

  useEffect(() => {
    if (!connected) return;
    void syncNow();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncNow();
    });
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      if (state.isConnected) void runUploadQueue().catch(() => {});
    });
    return () => {
      appState.remove();
      unsubscribeNet();
    };
  }, [connected]);
}
