/**
 * ===============================================================
 *  FILE: notifications/notificationsModule.ts
 *  WHAT: Loads expo-notifications only where it works.
 *        Expo Go on Android has no push support (removed in SDK 53),
 *        and in SDK 58 just importing expo-notifications there crashes
 *        with "Cannot find native module 'ExpoTopicSubscriptionModule'".
 *        So in Android Expo Go this is null and the app skips push;
 *        a development build, iPhone Expo Go and web get the real module.
 *  USED BY: notifications/push.ts, notifications/useNotificationNavigation.ts
 * ===============================================================
 */
import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';

type NotificationsModule = typeof import('expo-notifications');

/** true in Expo Go on Android: phone notifications are not available there */
export const notificationsUnavailable = Platform.OS === 'android' && isRunningInExpoGo();

// require() (not import) so the module is never loaded when it is unavailable
export const Notifications: NotificationsModule | null = notificationsUnavailable
  ? null
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-notifications') as NotificationsModule);
