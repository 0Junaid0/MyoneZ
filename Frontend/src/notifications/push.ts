/**
 * ===============================================================
 *  FILE: notifications/push.ts
 *  OWNER: Member 1  |  PHASE: 3 (Push Notifications)
 *  WHAT: Everything about phone push notifications:
 *    1. How a notification looks when the app is open
 *    2. Check / ask notification permission
 *    3. Get this phone's Expo push token and send it to the backend
 *    4. Open the phone's Settings if the user said "No" before
 *  BACKEND: POST /api/devices/  { token, platform }
 *  NOTE: Push tokens only work on a real phone, not a simulator.
 *        app.json must have extra.eas.projectId (run `eas init` once).
 * ===============================================================
 */
import { Linking, Platform } from 'react-native';
import type { PermissionStatus } from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { deviceApi } from '../api/deviceApi';
import { Notifications } from './notificationsModule';

/** 'unavailable' = Expo Go on Android (no notifications there; use a development build) */
export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

/* ---------- 1. Show banners even while the app is open ---------- */
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** Android needs a channel before it can show notifications */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android' || !Notifications) return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Reminders and drafts',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#1D4ED8',
  });
}

/* ---------- 2. Permission ---------- */
function toPermission(status: PermissionStatus): PushPermission {
  if (status === ('granted' as PermissionStatus)) return 'granted';
  if (status === ('denied' as PermissionStatus)) return 'denied';
  return 'undetermined';
}

/** Check only — never shows a popup */
export async function getPushPermission(): Promise<PushPermission> {
  if (!Notifications) return 'unavailable';
  const { status } = await Notifications.getPermissionsAsync();
  return toPermission(status);
}

/**
 * Shows the system popup (only the first time; after a "No",
 * the phone will not show it again — use openNotificationSettings).
 */
export async function requestPushPermission(): Promise<PushPermission> {
  if (!Notifications) return 'unavailable';
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.status === ('granted' as PermissionStatus)) return 'granted';
  if (!current.canAskAgain) return 'denied';
  const { status } = await Notifications.requestPermissionsAsync();
  return toPermission(status);
}

/* ---------- 3. Send this phone's token to the backend ---------- */
/**
 * Returns true when the token was saved on the server.
 * Safe to call many times; the backend should update the same token.
 */
export async function registerDeviceForPush(): Promise<boolean> {
  if (!Device.isDevice) {
    // simulator / emulator: no push token available
    return false;
  }
  if (!Notifications || (await getPushPermission()) !== 'granted') return false;

  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('[push] Missing extra.eas.projectId in app.json — run `eas init`.');
    return false;
  }

  await ensureAndroidChannel();
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await deviceApi.register({
    token,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
  });
  return true;
}

/* ---------- 4. Settings (after the user said "No") ---------- */
export async function openNotificationSettings(): Promise<void> {
  await Linking.openSettings();
}
