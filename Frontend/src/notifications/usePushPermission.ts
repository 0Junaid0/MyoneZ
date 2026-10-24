/**
 * ===============================================================
 *  FILE: notifications/usePushPermission.ts
 *  OWNER: Member 1  |  PHASE: 3 (Push Notifications)
 *  WHAT: A React hook that tells a page if notifications are on.
 *        It checks again when the user comes back from phone Settings,
 *        so the Home reminder card hides by itself after they turn it on.
 *  RETURNS: { status, request, openSettings }
 *  USED BY: Home (permission reminder card), Settings page (Member 4)
 *  EXAMPLE:
 *    const { status, request } = usePushPermission();
 *    if (status !== 'granted') show the "Turn on reminders" card
 * ===============================================================
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  getPushPermission,
  openNotificationSettings,
  PushPermission,
  requestPushPermission,
} from './push';

export interface UsePushPermission {
  /** null while checking the first time */
  status: PushPermission | null;
  /** Shows the popup, or opens Settings if the user said "No" before */
  request: () => Promise<PushPermission>;
  openSettings: () => Promise<void>;
}

export function usePushPermission(): UsePushPermission {
  const [status, setStatus] = useState<PushPermission | null>(null);

  const refresh = useCallback(async () => {
    setStatus(await getPushPermission());
  }, []);

  useEffect(() => {
    void refresh();
    // check again every time the app comes back to the front
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const request = useCallback(async () => {
    const result = await requestPushPermission();
    if (result === 'denied') {
      await openNotificationSettings();
    }
    setStatus(result);
    return result;
  }, []);

  return { status, request, openSettings: openNotificationSettings };
}
