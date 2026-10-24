/**
 * ===============================================================
 *  FILE: api/scheduleApi.ts
 *  WHAT: Builds the Schedule page list from upcoming check-ins
 *        (touchpoints) and messages waiting for their time.
 *  USED BY: pages/Schedule.tsx
 * ===============================================================
 */
import { fetchAll } from './client';
import { channelFromApi } from './contactsApi';
import type { ApiContact } from './contactsApi';
import { releaseDue } from './homeApi';
import type { ApiTouchpoint } from './homeApi';
import { fetchAllMessages } from './messagesApi';
import { startOfDay } from '../components/CalendarStrip';
import { formatTime } from '../components/TimePicker';
import type { ScheduleAction } from '../pages/Schedule';

const KIND: Record<string, ScheduleAction['kind']> = {
  birthday: 'Birthday',
  gratitude: 'Thank-you',
  reconnect: 'Follow-up',
};
const CHANNEL: Record<string, ScheduleAction['channel']> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  email: 'Gmail',
  messenger: 'Messenger',
};

export async function fetchSchedule(): Promise<ScheduleAction[]> {
  await releaseDue();
  const [contacts, touchpoints, messages] = await Promise.all([
    fetchAll<ApiContact>('/contacts/'),
    fetchAll<ApiTouchpoint>('/touchpoints/upcoming/'),
    fetchAllMessages(),
  ]);
  const byId = new Map(contacts.map((c) => [c.id, c]));
  const actions: ScheduleAction[] = [];

  const waiting = messages.filter((m) => m.status === 'approved' && m.scheduled_for);
  waiting.forEach((m) => {
    const due = new Date(m.scheduled_for as string);
    actions.push({
      id: `m-${m.id}`,
      contactId: m.contact,
      contactName: m.contact_info.name,
      avatarUrl: byId.get(m.contact)?.photo || m.contact_info.photo,
      kind: KIND[m.purpose] ?? 'Check-in',
      channel: CHANNEL[channelFromApi(m.channel || m.contact_info.preferred_channel)],
      date: startOfDay(due),
      time: formatTime(due),
      hour: due.getHours(),
      // time already passed -> overdue (still opens the draft so it can be sent)
      status: due.getTime() < Date.now() ? 'overdue' : 'scheduled',
      draftId: m.id,
    });
  });

  // Due messages already handed over (waiting for the user's tap) stay visible as "Ready"
  messages
    .filter((m) => m.status === 'queued')
    .forEach((m) => {
      const due = new Date(m.scheduled_for ?? m.updated_at);
      actions.push({
        id: `q-${m.id}`,
        contactId: m.contact,
        contactName: m.contact_info.name,
        avatarUrl: byId.get(m.contact)?.photo || m.contact_info.photo,
        kind: KIND[m.purpose] ?? 'Check-in',
        channel: CHANNEL[channelFromApi(m.channel || m.contact_info.preferred_channel)],
        date: startOfDay(due),
        time: formatTime(due),
        hour: due.getHours(),
        status: due.getTime() < Date.now() ? 'overdue' : 'ready',
        draftId: m.id,
      });
    });

  touchpoints.forEach((tp) => {
    const contact = byId.get(tp.contact_id);
    if (!contact || waiting.some((m) => m.touchpoint === tp.id)) return;
    const draft = messages.find((m) => m.contact === tp.contact_id && ['draft', 'queued'].includes(m.status));
    const due = new Date(tp.due_at);
    const overdue = tp.status === 'overdue' || due.getTime() < Date.now();
    actions.push({
      id: `t-${tp.id}`,
      contactId: contact.id,
      contactName: contact.name,
      avatarUrl: contact.photo,
      kind: draft ? (KIND[draft.purpose] ?? 'Check-in') : 'Check-in',
      channel: CHANNEL[channelFromApi(contact.preferred_channel)],
      date: startOfDay(due),
      hour: due.getHours(),
      status: overdue ? 'overdue' : draft ? 'ready' : 'scheduled',
      draftId: draft?.id,
    });
  });

  return actions;
}