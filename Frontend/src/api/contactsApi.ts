/**
 * ===============================================================
 *  FILE: api/contactsApi.ts
 *  WHAT: Contacts, memories, history and check-in rhythm, all
 *        against the Django API (/api/v1/contacts/...).
 *  NOTE: The screens use friendly names (Mentor, Professional,
 *        "values" memories ...). The mappers below translate them
 *        to the backend's words and back.
 * ===============================================================
 */
import axios from 'axios';
import { apiClient, fetchAll } from './client';
import type { ContactSummary, Relationship } from '../components/ContactCard';
import type { ContactFormValues } from '../components/ContactForm';
import type { FrequencyValue } from '../components/FrequencySelector';
import type { Memory, MemoryCategory } from '../components/MemoryCard';
import type { TimelineEntry } from '../components/TimelineItem';
import type { Channel, ContactChannel, Tone } from '../types/draft';
import { computeHealth, daysSince } from '../utils/health';
import { messengerUsername } from '../utils/messaging';

/* ------------------------------ backend shapes ------------------------------ */

export interface ApiSchedule {
  id: string;
  mode: 'fixed' | 'randomized';
  interval_min_days: number;
  interval_max_days: number;
  next_due_at: string | null;
  status: 'active' | 'paused';
}

export interface ApiContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  telegram: string;
  messenger: string;
  relationship: 'friend' | 'family' | 'colleague' | 'mentor' | 'other';
  tags: { id: string; name: string }[];
  birthday: string | null;
  timezone: string;
  preferred_channel: string;
  status: 'active' | 'paused' | 'archived';
  last_contacted_at: string | null;
  schedule: ApiSchedule | null;
  created_at: string;
}

interface ApiMemory {
  id: string;
  content: string;
  category: string;
  allow_drafting: boolean;
  created_at: string;
}

interface ApiInteraction {
  id: string;
  kind: string;
  channel: string;
  notes: string;
  occurred_at: string;
}

/* --------------------------------- mappers --------------------------------- */

const REL_TO_API: Record<Relationship, ApiContact['relationship']> = {
  Mentor: 'mentor',
  Friend: 'friend',
  Family: 'family',
  Professional: 'colleague',
  Collaborator: 'other',
};
const REL_FROM_API: Record<ApiContact['relationship'], Relationship> = {
  mentor: 'Mentor',
  friend: 'Friend',
  family: 'Family',
  colleague: 'Professional',
  other: 'Collaborator',
};
export const relationshipToApi = (r: Relationship) => REL_TO_API[r] ?? 'other';
export const relationshipFromApi = (r: string): Relationship =>
  REL_FROM_API[r as ApiContact['relationship']] ?? 'Collaborator';

/** Screens say "sms"; the backend calls the same thing "phone". "none" = Not set (empty). */
export const channelToApi = (c: ContactChannel): string => (c === 'sms' ? 'phone' : c === 'none' ? '' : c);
export const channelFromApi = (c: string | undefined): Channel =>
  c === 'phone'
    ? 'sms'
    : c === 'telegram'
      ? 'telegram'
      : c === 'email'
        ? 'email'
        : c === 'messenger'
          ? 'messenger'
          : 'whatsapp';

const CAT_TO_API: Record<MemoryCategory, string> = {
  values: 'preference',
  interests: 'interest',
  gratitude: 'shared_experience',
  events: 'life_event',
};
const CAT_FROM_API: Record<string, MemoryCategory> = {
  preference: 'values',
  interest: 'interests',
  shared_experience: 'gratitude',
  life_event: 'events',
};
export const categoryToApi = (c: MemoryCategory) => CAT_TO_API[c] ?? 'other';
export const categoryFromApi = (c: string): MemoryCategory => CAT_FROM_API[c] ?? 'values';

const TONE_TO_API: Record<Tone, string> = {
  friendly: 'friendly',
  professional: 'professional',
  warm: 'warm',
  casual: 'casual',
  formal: 'professional',
  advisory: 'custom',
};
const TONE_FROM_API: Record<string, Tone> = {
  warm: 'warm',
  friendly: 'friendly',
  casual: 'casual',
  professional: 'professional',
  custom: 'advisory',
};
export const toneToApi = (t: Tone) => TONE_TO_API[t] ?? 'warm';
export const toneFromApi = (t: string): Tone => TONE_FROM_API[t] ?? 'warm';

const TZ_LABELS: Record<string, string> = {
  'Asia/Dhaka': 'Asia/Dhaka (GMT+6)',
  'Asia/Kolkata': 'Asia/Kolkata (GMT+5:30)',
  'Asia/Dubai': 'Asia/Dubai (GMT+4)',
  'Europe/London': 'Europe/London (GMT+0)',
  'Europe/Berlin': 'Europe/Berlin (GMT+1)',
  'America/New_York': 'America/New_York (GMT-5)',
  'America/Los_Angeles': 'America/Los_Angeles (GMT-8)',
  'Australia/Sydney': 'Australia/Sydney (GMT+10)',
};
export const timezoneToApi = (label: string): string => label.split(' (')[0].trim();
export const timezoneFromApi = (iana: string): string => TZ_LABELS[iana] ?? TZ_LABELS['Asia/Dhaka'];

/** "1712 000000" -> "+8801712000000". Numbers typed with "+" keep their own country code. */
export function phoneToApi(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('880')) return `+${digits}`;
  return `+880${digits.replace(/^0/, '')}`;
}
/** The form shows the full number with its country code, e.g. "+8801712000000" */
export function phoneFromApi(e164: string): string {
  return e164 || '';
}
const prettyPhone = (e164: string) => (e164 ? e164.replace(/^(\+880)(\d+)/, '$1 $2') : undefined);

export function frequencyToApi(f: FrequencyValue) {
  if (f.mode === 'fixed') {
    return { mode: 'fixed' as const, interval_min_days: f.days, interval_max_days: f.days };
  }
  return {
    mode: 'randomized' as const,
    interval_min_days: Math.max(1, f.days - f.jitter),
    interval_max_days: Math.max(1, f.days - f.jitter, f.days + f.jitter),
  };
}
export function frequencyFromApi(s: ApiSchedule | null): FrequencyValue {
  if (!s) return { mode: 'randomized', days: 30, jitter: 5 };
  if (s.mode === 'fixed') return { mode: 'fixed', days: s.interval_min_days, jitter: 0 };
  return {
    mode: 'randomized',
    days: Math.round((s.interval_min_days + s.interval_max_days) / 2),
    jitter: Math.round((s.interval_max_days - s.interval_min_days) / 2),
  };
}

export function intervalOf(c: ApiContact): number {
  const s = c.schedule;
  return s ? (s.interval_min_days + s.interval_max_days) / 2 : 30;
}

export function toSummary(c: ApiContact): ContactSummary {
  const days = daysSince(c.last_contacted_at) ?? daysSince(c.created_at) ?? 0;
  return {
    id: c.id,
    name: c.name,
    relationship: relationshipFromApi(c.relationship),
    daysSinceContact: days,
    healthScore: computeHealth(c.last_contacted_at ? days : days, intervalOf(c)),
    tags: c.tags.length ? c.tags.map((t) => t.name) : undefined,
    // Only used by the search box (name, email or number)
    searchExtra: [c.email, c.phone, c.whatsapp, c.telegram, c.messenger].filter(Boolean).join(' '),
  };
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function nextCheckInText(iso: string | null | undefined): string {
  if (!iso) return 'Not scheduled';
  const due = new Date(iso);
  const days = Math.round((due.getTime() - Date.now()) / 86400000);
  const when = due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  if (days === 0) return `${when} · today`;
  return days > 0 ? `${when} · in ${days} day${days === 1 ? '' : 's'}` : `${when} · ${-days} day${days === -1 ? '' : 's'} late`;
}

/* ------------------------------ ContactDetails ------------------------------ */

export type ContactDetailData = ContactSummary & {
  nextCheckIn: string;
  intervalDays: number;
  jitterDays: number;
  channel: 'Telegram' | 'WhatsApp' | 'SMS' | 'Gmail' | 'Messenger' | 'Not set';
  phone?: string;
  whatsapp?: string;
  telegram?: string;
  messenger?: string;
  email?: string;
  birthday?: string;
  timezone?: string;
  memories: Memory[];
  history: TimelineEntry[];
};

const CHANNEL_NAME = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  email: 'Gmail',
  messenger: 'Messenger',
} as const;

export const contactsApi = {
  async list(): Promise<ContactSummary[]> {
    const all = await fetchAll<ApiContact>('/contacts/');
    return all.filter((c) => c.status !== 'archived').map(toSummary);
  },

  async getRaw(id: string): Promise<ApiContact> {
    return (await apiClient.get<ApiContact>(`/contacts/${id}/`)).data;
  },

  async getDetail(id: string): Promise<ContactDetailData> {
    const [c, memories, interactions] = await Promise.all([
      contactsApi.getRaw(id),
      fetchAll<ApiMemory>(`/contacts/${id}/memories/`),
      fetchAll<ApiInteraction>(`/contacts/${id}/interactions/`),
    ]);
    const freq = frequencyFromApi(c.schedule);
    return {
      ...toSummary(c),
      nextCheckIn: nextCheckInText(c.schedule?.next_due_at),
      intervalDays: freq.days,
      jitterDays: freq.jitter,
      channel: c.preferred_channel ? CHANNEL_NAME[channelFromApi(c.preferred_channel)] : 'Not set',
      phone: prettyPhone(c.phone),
      whatsapp: prettyPhone(c.whatsapp),
      telegram: c.telegram || undefined,
      messenger: c.messenger || undefined,
      email: c.email || undefined,
      birthday: c.birthday
        ? new Date(c.birthday).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
        : undefined,
      timezone: c.timezone ? timezoneFromApi(c.timezone) : undefined,
      memories: memories.map((m) => ({ id: m.id, category: categoryFromApi(m.category), text: m.content })),
      history: interactions.map((i) => ({
        id: i.id,
        type: i.kind === 'message' ? 'message' : 'talk',
        title:
          i.kind === 'message'
            ? `Sent a message${i.channel ? ` on ${i.channel === 'phone' ? 'SMS' : i.channel}` : ''}`
            : 'Logged a conversation',
        date: fmtDate(i.occurred_at),
        note: i.notes && i.kind !== 'message' ? i.notes : undefined,
      })),
    };
  },

  async getFormValues(id: string): Promise<ContactFormValues> {
    const c = await contactsApi.getRaw(id);
    const [first, ...rest] = c.name.split(' ');
    const whatsappSame = !c.whatsapp || c.whatsapp === c.phone;
    return {
      photoUri: null,
      firstName: first ?? '',
      lastName: rest.join(' '),
      relationship: relationshipFromApi(c.relationship),
      tags: c.tags.map((t) => t.name).join(', '),
      phone: phoneFromApi(c.phone),
      whatsappSame,
      whatsapp: whatsappSame ? '' : phoneFromApi(c.whatsapp),
      telegram: c.telegram,
      messenger: c.messenger ?? '',
      email: c.email,
      channel: c.preferred_channel ? channelFromApi(c.preferred_channel) : 'none',
      frequency: frequencyFromApi(c.schedule),
      lastContact: c.last_contacted_at ? new Date(c.last_contacted_at) : null,
      birthday: c.birthday ? new Date(c.birthday) : null,
      timezone: timezoneFromApi(c.timezone),
      memoryCategory: 'values',
      memoryText: '', // memories are listed on the contact page; type here to add one more
      tone: 'warm',
    };
  },

  async create(values: ContactFormValues): Promise<{ id: string }> {
    const tag_ids = await ensureTagIds(values);
    const res = await withTagFallback(tag_ids, (ids) =>
      apiClient.post<ApiContact>('/contacts/', { ...toContactBody(values), tag_ids: ids }),
    );
    const id = res.data.id;
    // "Last time you talked" goes in BEFORE the rhythm: the backend counts the first check-in
    // from it, so a date long ago makes the first check-in due today (PRD M12).
    if (values.lastContact) {
      await apiClient.post(`/contacts/${id}/interactions/`, {
        kind: 'custom',
        notes: 'Last time we talked',
        occurred_at: values.lastContact.toISOString(),
      });
    }
    await apiClient.post(`/contacts/${id}/schedules/`, { ...frequencyToApi(values.frequency), status: 'active' });
    if (values.memoryText.trim()) await contactsApi.addMemory(id, values.memoryText, values.memoryCategory);
    return { id };
  },

  async update(id: string, values: ContactFormValues): Promise<void> {
    const tag_ids = await ensureTagIds(values);
    const current = await contactsApi.getRaw(id);
    await withTagFallback(tag_ids, (ids) =>
      apiClient.patch(`/contacts/${id}/`, { ...toContactBody(values), tag_ids: ids }),
    );
    const rhythm = frequencyToApi(values.frequency);
    if (current.schedule) {
      await apiClient.patch(`/contacts/${id}/schedules/${current.schedule.id}/`, rhythm);
    } else {
      await apiClient.post(`/contacts/${id}/schedules/`, { ...rhythm, status: 'active' });
    }
    if (values.memoryText.trim()) await contactsApi.addMemory(id, values.memoryText, values.memoryCategory);
  },

  /** Touchpoint (next check-in) of a contact, if it has an active rhythm */
  async getNextTouchpoint(contactId: string): Promise<{ id: string; due_at: string } | null> {
    const res = await fetchAll<{ id: string; due_at: string }>('/touchpoints/upcoming/', {
      schedule__contact: contactId,
    });
    return res.sort((a, b) => a.due_at.localeCompare(b.due_at))[0] ?? null;
  },

  /** "Schedule next check-in" + "Save time": moves the next check-in to a date and time */
  async rescheduleNextCheckIn(contactId: string, when: Date): Promise<void> {
    const point = await contactsApi.getNextTouchpoint(contactId);
    if (!point) throw new Error('This contact has no check-in rhythm yet. Set one with "Change rhythm".');
    await apiClient.patch(`/touchpoints/${point.id}/reschedule/`, { due_at: when.toISOString() });
  },

  /** "Outreach rhythm" + "Save rhythm": days between check-ins */
  async saveRhythm(contactId: string, frequency: FrequencyValue): Promise<void> {
    const current = await contactsApi.getRaw(contactId);
    const rhythm = frequencyToApi(frequency);
    if (current.schedule) {
      await apiClient.patch(`/contacts/${contactId}/schedules/${current.schedule.id}/`, rhythm);
    } else {
      await apiClient.post(`/contacts/${contactId}/schedules/`, { ...rhythm, status: 'active' });
    }
  },

  async getFrequency(contactId: string): Promise<FrequencyValue> {
    return frequencyFromApi((await contactsApi.getRaw(contactId)).schedule);
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/contacts/${id}/`, { params: { permanent: 'true' } });
  },

  async addMemory(contactId: string, text: string, category: MemoryCategory): Promise<void> {
    await apiClient.post(`/contacts/${contactId}/memories/`, {
      content: text.trim(),
      category: categoryToApi(category),
      allow_drafting: true, // so drafts can use it
    });
  },

  async logTalk(contactId: string): Promise<void> {
    await apiClient.post(`/contacts/${contactId}/interactions/`, {
      kind: 'custom',
      notes: 'Logged a conversation',
      occurred_at: new Date().toISOString(),
    });
  },
};

function toContactBody(v: ContactFormValues) {
  const phone = phoneToApi(v.phone);
  const whatsapp = v.whatsappSame ? phone : phoneToApi(v.whatsapp);
  return {
    name: `${v.firstName} ${v.lastName}`.trim(),
    relationship: relationshipToApi(v.relationship),
    email: v.email.trim(),
    phone,
    whatsapp,
    telegram: v.telegram.trim(),
    // Save the clean id, so a pasted profile link still opens the chat
    messenger: messengerUsername(v.messenger) ?? v.messenger.trim(),
    preferred_channel: channelToApi(v.channel),
    timezone: timezoneToApi(v.timezone),
    birthday: v.birthday ? toDateOnly(v.birthday) : null,
  };
}

function toDateOnly(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** True when the API rejected the tag_ids field itself (e.g. 'Invalid pk "..." - object does not exist.') */
function isTagIdsError(e: unknown): boolean {
  if (!axios.isAxiosError(e) || e.response?.status !== 400) return false;
  const data = e.response.data as { error?: { detail?: unknown } } | undefined;
  const detail = data?.error?.detail ?? data;
  return !!detail && typeof detail === 'object' && 'tag_ids' in (detail as Record<string, unknown>);
}

/**
 * Saves the contact with its tags. If the server refuses only the tag ids,
 * the contact is saved without them instead of failing the whole save.
 */
async function withTagFallback<T>(tagIds: string[], send: (ids: string[]) => Promise<T>): Promise<T> {
  try {
    return await send(tagIds);
  } catch (e) {
    if (tagIds.length > 0 && isTagIdsError(e)) return send([]);
    throw e;
  }
}

async function ensureTagIds(v: ContactFormValues): Promise<string[]> {
  // "Friend, friend" is one tag: dedupe by lower-case name
  const names = Array.from(
    new Map(
      v.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => [t.toLowerCase(), t] as const),
    ).values(),
  );
  if (names.length === 0) return [];
  const existing = await fetchAll<{ id: string; name: string }>('/tags/');
  const find = (name: string) => existing.find((t) => t.name.toLowerCase() === name.toLowerCase());
  const ids: string[] = [];
  for (const name of names) {
    let tag = find(name);
    if (!tag) {
      try {
        tag = (await apiClient.post<{ id: string; name: string }>('/tags/', { name })).data;
        existing.push(tag);
      } catch {
        // Someone (or an earlier save) created it a moment ago: reload and use that one
        existing.splice(0, existing.length, ...(await fetchAll<{ id: string; name: string }>('/tags/')));
        tag = find(name);
        if (!tag) throw new Error(`Could not save the tag "${name}".`);
      }
    }
    ids.push(tag.id);
  }
  return ids;
}