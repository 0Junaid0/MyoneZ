/**
 * ===============================================================
 *  FILE: notifications/useNotificationNavigation.ts
 *  OWNER: Member 1  |  PHASE: 3 (Push Notifications)
 *  WHAT: When the user taps a push notification, open the right screen.
 *        Works when the app is open AND when the tap starts a closed app.
 *
 *  BACKEND sends data like:  { "type": "draft_ready", "draft_id": "42" }
 *    type            → screen
 *    draft_ready     → ReviewDraft { draftId }
 *    reminder        → ReviewDraft { draftId }  (WhatsApp "time to send")
 *    heads_up        → ContactDetails { contactId }  (birthday tomorrow)
 *    check_in        → ContactDetails { contactId }  (a check-in is due)
 *    delivery_failed → Drafts tab, "Failed" filter
 *    daily_summary   → Home
 *
 *  MEMBER 4 (App.tsx) wires it like this:
 *    export const navigationRef = createNavigationContainerRef<AppStackParamList>();
 *    ...
 *    useNotificationNavigation((target) => {
 *      if (navigationRef.isReady()) navigateToTarget(navigationRef, target);
 *    }, status === 'signedIn');
 * ===============================================================
 */
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import type { NotificationResponse } from 'expo-notifications';
import { Notifications } from './notificationsModule';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import type { AppStackParamList } from '../types/navigation';

export type NotificationTarget =
  | { screen: 'ReviewDraft'; draftId: string }
  | { screen: 'ContactDetails'; contactId: string }
  | { screen: 'FailedDrafts' }
  | { screen: 'Home' };

function readId(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number') return String(value);
  return null;
}

/** Turns the notification's data into the screen to open */
export function resolveNotificationTarget(data: Record<string, unknown> | undefined): NotificationTarget {
  const type = data?.type;
  const draftId = readId(data?.draft_id);
  const contactId = readId(data?.contact_id);

  if ((type === 'draft_ready' || type === 'reminder') && draftId) {
    return { screen: 'ReviewDraft', draftId };
  }
  // check_in: a check-in with this person is due (backend apps/messaging/push.py)
  if ((type === 'heads_up' || type === 'check_in') && contactId) {
    return { screen: 'ContactDetails', contactId };
  }
  if (type === 'delivery_failed') {
    return { screen: 'FailedDrafts' };
  }
  return { screen: 'Home' };
}

/** Does the actual navigate() call. Member 4 passes their navigationRef. */
export function navigateToTarget(
  navigation: NavigationContainerRefWithCurrent<AppStackParamList>,
  target: NotificationTarget,
): void {
  switch (target.screen) {
    case 'ReviewDraft':
      navigation.navigate('ReviewDraft', { draftId: target.draftId });
      break;
    case 'ContactDetails':
      navigation.navigate('ContactDetails', { contactId: target.contactId });
      break;
    case 'FailedDrafts':
      navigation.navigate('Tabs', { screen: 'Drafts', params: { tab: 'failed' } });
      break;
    default:
      navigation.navigate('Tabs', { screen: 'Home' });
  }
}

/**
 * Listens for notification taps.
 * @param onOpen  called with the screen to open
 * @param enabled pass `status === 'signedIn'` so taps wait until the user is logged in
 */
export function useNotificationNavigation(
  onOpen: (target: NotificationTarget) => void,
  enabled: boolean,
): void {
  // keep the latest callback without re-subscribing every render
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const handledIds = useRef(new Set<string>());

  useEffect(() => {
    // Push taps only exist on a phone; the web build has no notification API
    // (Expo Go on Android has no notifications: Notifications is null there)
    if (!enabled || Platform.OS === 'web' || !Notifications) return;

    const handle = (response: NotificationResponse) => {
      const id = response.notification.request.identifier;
      if (handledIds.current.has(id)) return; // never open the same tap twice
      handledIds.current.add(id);
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      onOpenRef.current(resolveNotificationTarget(data));
    };

    // 1. The app was closed and the user opened it by tapping a notification
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handle(response);
    });

    // 2. The app is open or in the background
    const subscription = Notifications.addNotificationResponseReceivedListener(handle);
    return () => subscription.remove();
  }, [enabled]);
}
