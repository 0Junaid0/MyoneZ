/**
 * ===============================================================
 *  FILE: notifications/push.ts
 *  OWNER: Member 1  |  PHASE: 3 (Push Notifications)
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

const shownNotificationIds = new Set<string>();

/* ---------- 1. Show banners even while the app is open ---------- */
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** Android needs a channel before it can show notifications */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android' || !Notifications) return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Reminders and drafts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
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

/* ---------- 3. Trigger Android System Tray Notification Directly ---------- */
export async function presentLocalNotification(note: {
  id: string;
  title: string;
  body: string;
  push?: Record<string, unknown>;
}): Promise<void> {
  if (!Notifications || shownNotificationIds.has(note.id)) return;
  const perm = await requestPushPermission();
  if (perm !== 'granted') return;

  shownNotificationIds.add(note.id);
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: note.title,
      body: note.body,
      data: note.push ?? {},
      sound: 'default',
    },
    trigger: null, // Shows immediately in the Android notification shade
  });
}

/* ---------- 4. Send this phone's token to the backend ---------- */
export async function registerDeviceForPush(): Promise<boolean> {
  if (!Device.isDevice) {
    return false;
  }
  if (!Notifications || (await getPushPermission()) !== 'granted') return false;

  await ensureAndroidChannel();

  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('[push] Missing extra.eas.projectId in app.json — run `eas init`.');
    return false;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await deviceApi.register({
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    return true;
  } catch (err) {
    // Expected on Android standalone APK if Firebase (FCM) is not configured;
    // local system tray notifications via presentLocalNotification still work!
    console.warn('[push] Remote push token skipped (using local notifications):', err);
    return false;
  }
}

/* ---------- 5. Settings (after the user said "No") ---------- */
export async function openNotificationSettings(): Promise<void> {
  await Linking.openSettings();
}