// MOCK (Member 1): Home data from the design (M05). contact_id values match the mock list in pages/Contacts.tsx.
// draft_id is null so a row opens the contact (the drafts mock uses other people).
// Turn off with USE_MOCK_HOME in api/homeApi.ts.
import dayjs from 'dayjs';
import type { HomeSummary } from '../../types/api';

export async function getMockHomeSummary(): Promise<HomeSummary> {
  await new Promise<void>((resolve) => setTimeout(resolve, 300));
  const today = dayjs().format('YYYY-MM-DD');
  return {
    total_contacts: 12,
    drafts_waiting: 4,
    due_today: 2,
    overdue: 2,
    later_this_week: 2,
    network_health: 68,
    unread_notifications: 3,
    recent_contacts: [
      { id: 'r1', name: 'Rafi Ahmed', relationship: 'Friend', health_score: 34, days_since_contact: 21 },
      { id: 'r2', name: 'Nusrat Jahan', relationship: 'Mentor', health_score: 58, days_since_contact: 9 },
    ],
    up_next: [
      {
        contact_id: '2', draft_id: null, name: 'Maya Lindqvist', avatar_url: null,
        relationship: 'Friend', reason: 'Check-in', channel: 'telegram', last_contacted_days: 54,
        health_score: 32, status: 'overdue', days_late: 24, due_date: dayjs().subtract(24, 'day').format('YYYY-MM-DD'),
      },
      {
        contact_id: '1', draft_id: null, name: 'Tanvir Hasan', avatar_url: null,
        relationship: 'Colleague', reason: 'Project follow-up', channel: 'sms', last_contacted_days: 44,
        health_score: 41, status: 'overdue', days_late: 14, due_date: dayjs().subtract(14, 'day').format('YYYY-MM-DD'),
      },
      {
        contact_id: '7', draft_id: null, name: 'Arif Khan', avatar_url: null,
        relationship: 'Friend', reason: 'Birthday', channel: 'whatsapp', last_contacted_days: 21,
        health_score: 74, status: 'today', due_date: today,
      },
      {
        contact_id: '5', draft_id: null, name: 'Sadia Islam', avatar_url: null,
        relationship: 'Family', reason: 'Check-in', channel: 'whatsapp', last_contacted_days: 30,
        health_score: 66, status: 'today', due_date: today,
      },
    ],
  };
}
