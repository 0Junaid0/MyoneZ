/**
 * ===============================================================
 *  FILE: api/notificationsApi.ts
 *  WHAT: In-app notifications from the Django API
 *        (/api/v1/notifications/). The backend only lists the
 *        ones not opened yet; opening one removes it.
 *  USED BY: pages/Notifications.tsx, App.tsx
 * ===============================================================
 */
import { apiClient } from './client';
import { releaseDue } from './homeApi';
import type { AppNotification } from '../components/NotificationItem';
import { presentLocalNotification } from '../notifications/push';

interface ApiNotification {
  id: string;
  kind: 'message' | 'touchpoint';
  message_id: string | null;
  contact_id: string;
  title: string;
  body: string;
  created_at: string;
  push?: Record<string, unknown>;
}

function toNotification(n: ApiNotification): AppNotification {
  const notSent = /was not sent/i.test(n.title);
  return {
    id: n.id,
    type: notSent || n.kind === 'touchpoint' ? 'overdue' : 'checkin',
    title: n.title,
    body: n.body,
    createdAt: new Date(n.created_at),
    read: false,
    target:
      n.kind === 'message' && n.message_id
        ? { route: 'ReviewDraft', params: { draftId: n.message_id } }
        : { route: 'ContactDetails', params: { id: n.contact_id } },
  };
}

export const notificationsApi = {
  async list(): Promise<AppNotification[]> {
    await releaseDue();
    const res = await apiClient.get<{ results: ApiNotification[] }>('/notifications/');
    const results = res.data.results ?? [];

    // Trigger Android system tray notification for each new unread item
    for (const n of results) {
      const fallbackPush =
        n.kind === 'message' && n.message_id
          ? { type: 'reminder', draft_id: n.message_id, contact_id: n.contact_id, notification_id: n.id }
          : { type: 'check_in', contact_id: n.contact_id, notification_id: n.id };

      void presentLocalNotification({
        id: n.id,
        title: n.title,
        body: n.body,
        push: n.push ?? fallbackPush,
      });
    }

    return results.map(toNotification);
  },
  async open(id: string): Promise<void> {
    await apiClient.post(`/notifications/${id}/open/`);
  },
  async openAll(ids: string[]): Promise<void> {
    await Promise.all(ids.map((id) => notificationsApi.open(id)));
  },
};