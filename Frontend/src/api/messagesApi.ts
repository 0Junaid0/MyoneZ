/**
 * ===============================================================
 *  FILE: api/messagesApi.ts
 *  WHAT: Backend "messages" (/api/v1/messages/) in the shape the
 *        Drafts / Home / Schedule screens use (Draft).
 *  STATUS MAP (backend -> screens):
 *     draft, queued      -> pending_review  (needs the user)
 *     approved           -> scheduled       (waits for its time)
 *     sent, delivered    -> sent
 *     failed             -> failed
 *     cancelled          -> hidden
 * ===============================================================
 */
import { fetchAll } from './client';
import { channelFromApi, toneFromApi } from './contactsApi';
import type { Channel, Draft, DraftReason, DraftStatus } from '../types/draft';
import { computeHealth, daysSince } from '../utils/health';

export interface ApiContactInfo {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  telegram: string;
  timezone: string;
  preferred_channel: string;
  channels: string[];
  last_contacted_at: string | null;
  created_at: string;
  interval_days: number | null;
}

export interface ApiMessage {
  id: string;
  contact: string;
  touchpoint: string | null;
  purpose: string;
  tone: string;
  length: string;
  custom_instruction: string;
  body: string;
  status: 'draft' | 'approved' | 'queued' | 'sent' | 'delivered' | 'failed' | 'cancelled';
  channel: string;
  scheduled_for: string | null;
  context_snapshot: { memories?: { content: string }[] };
  delivery_attempts?: { error?: string }[];
  contact_info: ApiContactInfo;
  touchpoint_due_at: string | null;
  created_at: string;
  updated_at: string;
}

const PURPOSE_TO_REASON: Record<string, DraftReason> = {
  check_in: 'check_in',
  reconnect: 'reconnect',
  birthday: 'birthday',
  gratitude: 'thanks',
  congratulations: 'congrats',
  custom: 'other',
};
export const reasonFromPurpose = (p: string): DraftReason => PURPOSE_TO_REASON[p] ?? 'other';
export const purposeFromReason = (r: DraftReason): string =>
  ({ check_in: 'check_in', reconnect: 'reconnect', birthday: 'birthday', thanks: 'gratitude', congrats: 'congratulations', other: 'custom' })[r];

export const MANUAL_MARK = 'manual';

export function draftStatusOf(m: ApiMessage): DraftStatus {
  switch (m.status) {
    case 'approved':
      return 'scheduled';
    case 'sent':
    case 'delivered':
      return 'sent';
    case 'failed':
      return 'failed';
    default:
      return 'pending_review';
  }
}

export function toDraft(m: ApiMessage): Draft {
  const info = m.contact_info;
  const status = draftStatusOf(m);
  const days = daysSince(info.last_contacted_at) ?? daysSince(info.created_at) ?? 0;
  const channels = Array.from(new Set(info.channels.filter((c) => ['whatsapp', 'telegram', 'phone', 'email', 'messenger'].includes(c)).map(channelFromApi)));
  const channel = channelFromApi(m.channel || info.preferred_channel);
  const lastError = m.delivery_attempts?.length ? m.delivery_attempts[m.delivery_attempts.length - 1].error : undefined;
  return {
    id: m.id,
    contactId: info.id,
    contactName: info.name,
    contactPhone: info.phone || info.whatsapp || undefined,
    contactWhatsapp: info.whatsapp || info.phone || undefined,
    contactTelegram: info.telegram || undefined,
    contactTimezone: info.timezone || 'Asia/Dhaka',
    contactChannels: channels.length ? channels : [channel],
    healthScore: computeHealth(days, info.interval_days),
    body: m.body,
    tone: toneFromApi(m.tone),
    length: m.length === 'short' || m.length === 'long' ? m.length : 'medium',
    channel,
    status,
    reason: reasonFromPurpose(m.purpose),
    reasonNote: m.custom_instruction && m.custom_instruction !== MANUAL_MARK ? m.custom_instruction : undefined,
    source: m.custom_instruction === MANUAL_MARK ? 'manual' : 'ai',
    generation: 'ready',
    memoriesUsed: (m.context_snapshot?.memories ?? []).map((x) => x.content),
    daysLate: daysSince(m.touchpoint_due_at) ?? 0,
    scheduledAt: status === 'scheduled' ? (m.scheduled_for ?? undefined) : undefined,
    sendMode: status === 'scheduled' ? 'remind' : undefined,
    failureReason: status === 'failed' ? (lastError || 'The message could not be sent.') : undefined,
    updatedAt: m.updated_at,
  };
}

export async function fetchAllMessages(): Promise<ApiMessage[]> {
  const all = await fetchAll<ApiMessage>('/messages/');
  return all.filter((m) => m.status !== 'cancelled');
}

export type { Channel };
