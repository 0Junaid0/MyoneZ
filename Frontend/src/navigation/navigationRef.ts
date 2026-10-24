// navigation/navigationRef.ts  (Owner: Member 4)
// Navigate from anywhere (outside React components too).
// Member 1: when a push notification is tapped, call navigateToTarget(notification.target).
import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';
import type { NotificationTarget } from '../components/NotificationItem';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateToTarget(target: NotificationTarget): void {
  if (!navigationRef.isReady()) return;

  switch (target.route) {
    case 'Drafts':
      navigationRef.navigate('Tabs', { screen: 'Drafts', params: { tab: target.params?.tab } });
      break;
    case 'ReviewDraft': {
      const draftId = target.params?.draftId;
      if (draftId) navigationRef.navigate('ReviewDraft', { draftId, mode: 'review' });
      break;
    }
    case 'ContactDetails': {
      const id = target.params?.id;
      if (id) navigationRef.navigate('ContactDetails', { id });
      break;
    }
  }
}
