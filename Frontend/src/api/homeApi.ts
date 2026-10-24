/**
 * ===============================================================
 *  FILE: api/homeApi.ts
 *  WHAT: Builds everything the Home page shows from the Django API:
 *        contacts, upcoming check-ins (touchpoints), drafts and
 *        notifications. The backend has no single "home" endpoint,
 *        so this file does the counting.
 *  USED BY: pages/Home.tsx
 * ===============================================================
 */
import { apiClient, fetchAll } from './client';
import { channelFromApi, intervalOf, relationshipFromApi } from './contactsApi';
import type { ApiContact } from './contactsApi';
import { fetchAllMessages } from './messagesApi';
import type { HomeSummary, UpNextItem, UpNextStatus } from '../types/api';
import { computeHealth, daysSince } from '../utils/health';
import { getMockHomeSummary } from './mocks/homeMock';

/** true -> Home shows the design's sample data (api/mocks/homeMock.ts); false -> the Django API */
export const USE_MOCK_HOME = false;

export interface ApiTouchpoint {
  id: string;
  contact_id: string;
  due_at: string;
  status: string;
  reasons: string[];
}

export const startOfToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DAY = 86400000;

/** Asks the backend to release anything that became due (it also runs this by itself every 10 s) */
export async function releaseDue(): Promise<void> {
  try {
    await apiClient.post('/messages/dispatch-due/');
  } catch {
    // not critical
  }
}

export const homeApi = {
  async getSummary(): Promise<HomeSummary> {
    if (USE_MOCK_HOME) return getMockHomeSummary(); // MOCK
    await releaseDue();
    const [contacts, touchpoints, messages, notes] = await Promise.all([
      fetchAll<ApiContact>('/contacts/'),
      fetchAll<ApiTouchpoint>('/touchpoints/upcoming/'),
      fetchAllMessages(),
      apiClient.get<{ results: unknown[] }>('/notifications/'),
    ]);

    const active = contacts.filter((c) => c.status === 'active');
    const byId = new Map(contacts.map((c) => [c.id, c]));
    const healthOf = (c: ApiContact) => {
      const days = daysSince(c.last_contacted_at) ?? daysSince(c.created_at) ?? 0;
      return computeHealth(days, intervalOf(c));
    };

    const today = startOfToday();
    const tomorrow = new Date(today.getTime() + DAY);
    const weekEnd = new Date(today.getTime() + 8 * DAY);
    const statusOf = (tp: ApiTouchpoint): UpNextStatus => {
      const due = new Date(tp.due_at);
      if (tp.status === 'overdue' || due < new Date()) return 'overdue';
      return due < tomorrow ? 'today' : 'upcoming';
    };

    const sorted = [...touchpoints].sort((a, b) => a.due_at.localeCompare(b.due_at));
    const up_next: UpNextItem[] = sorted
      .filter((tp) => byId.has(tp.contact_id))
      .slice(0, 10)
      .map((tp) => {
        const c = byId.get(tp.contact_id) as ApiContact;
        const draft = messages.find((m) => m.contact === c.id && ['draft', 'queued'].includes(m.status));
        const status = statusOf(tp);
        return {
          contact_id: c.id,
          draft_id: draft?.id ?? null,
          name: c.name,
          avatar_url: c.photo || null,
          relationship: relationshipFromApi(c.relationship),
          reason: 'Check-in',
          channel: channelFromApi(c.preferred_channel),
          last_contacted_days: daysSince(c.last_contacted_at),
          health_score: healthOf(c),
          status,
          days_late: status === 'overdue' ? (daysSince(tp.due_at) ?? 0) : undefined,
          due_date: isoDate(new Date(tp.due_at)),
        };
      });

    // Count what needs the user, the same way the Schedule tab lists it:
    //  - check-ins (touchpoints) that have no reminder yet, and
    //  - reminders the user scheduled (approved) or that just became ready (queued).
    // A check-in that already has a reminder is counted once, as the reminder.
    const reminders = messages.filter((m) => (m.status === 'approved' && !!m.scheduled_for) || m.status === 'queued');
    const covered = new Set(reminders.map((m) => m.touchpoint).filter((id): id is string => !!id));
    const slots: { due: Date; status: UpNextStatus }[] = [];
    touchpoints
      .filter((tp) => !covered.has(tp.id))
      .forEach((tp) => slots.push({ due: new Date(tp.due_at), status: statusOf(tp) }));
    reminders.forEach((m) => {
      const due = new Date(m.scheduled_for ?? m.updated_at);
      if (Number.isNaN(due.getTime())) return;
      // time already passed = overdue; later today = due today; after today = upcoming
      const status: UpNextStatus = due < new Date() ? 'overdue' : due < tomorrow ? 'today' : 'upcoming';
      slots.push({ due, status });
    });
    const network = active.length ? Math.round(active.reduce((sum, c) => sum + healthOf(c), 0) / active.length) : 0;
    return {
      total_contacts: active.length,
      drafts_waiting: messages.filter((m) => m.status === 'draft' || m.status === 'queued').length,
      due_today: slots.filter((x) => x.status === 'today').length,
      overdue: slots.filter((x) => x.status === 'overdue').length,
      later_this_week: slots.filter((x) => x.status === 'upcoming' && x.due < weekEnd).length,
      network_health: network,
      unread_notifications: notes.data.results?.length ?? 0,
      up_next,
      // Newest contacts first ("Recently added")
      recent_contacts: [...active]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 3)
        .map((c) => ({
          id: c.id,
          name: c.name,
          relationship: relationshipFromApi(c.relationship),
          health_score: healthOf(c),
          days_since_contact: daysSince(c.last_contacted_at) ?? daysSince(c.created_at) ?? 0,
        })),
    };
  },
};
