/**
 * ===============================================================
 *  FILE: api/draftsReal.ts
 *  WHAT: The REAL drafts API: talks to the Django messages
 *        endpoints (/api/v1/messages/...). Used by api/drafts.ts
 *        when USE_MOCK_DRAFTS is false.
 *  HOW SENDING WORKS: the app opens WhatsApp / SMS / Telegram
 *        itself with the text filled in. After the user says "Yes,
 *        mark as sent", markSent() approves the message, marks it
 *        sent and logs a check-in, which schedules the next one.
 * ===============================================================
 */
import { apiClient, fetchAll } from './client';
import { channelFromApi, channelToApi, contactsApi, intervalOf, toneToApi } from './contactsApi';
import type { ApiContact } from './contactsApi';
import {
  MANUAL_MARK,
  draftStatusOf,
  fetchAllMessages,
  purposeFromReason,
  toDraft,
  type ApiMessage,
} from './messagesApi';
import { releaseDue } from './homeApi';
import type { DraftsApi } from './drafts';
import type { Channel, ComposeDraftInput, Draft, OpenMessageRef, SentResult } from '../types/draft';
import { computeHealth, daysSince } from '../utils/health';

const getMessage = async (id: string): Promise<ApiMessage> => (await apiClient.get<ApiMessage>(`/messages/${id}/`)).data;
const patchMessage = async (id: string, body: Record<string, unknown>): Promise<ApiMessage> =>
  (await apiClient.patch<ApiMessage>(`/messages/${id}/`, body)).data;

const ADVISORY_NOTE = 'Use a gentle, advisory tone.';

/** Gmail and Messenger need the contact's email / Messenger username, which the message does not carry */
function withContactDetails(draft: Draft, contact: ApiContact | undefined): Draft {
  if (!contact) return draft;
  return {
    ...draft,
    contactEmail: contact.email || undefined,
    contactMessenger: contact.messenger || undefined,
    contactAvatarUrl: contact.photo || draft.contactAvatarUrl,
  };
}

/** A draft from a PATCH / regenerate response, with the contact's email and Messenger username added back */
async function toDraftWithContact(message: ApiMessage): Promise<Draft> {
  const contact = await contactsApi.getRaw(message.contact).catch(() => undefined);
  return withContactDetails(toDraft(message), contact);
}

function toOpenRef(m: ApiMessage): OpenMessageRef {
  const draft = toDraft(m);
  return {
    id: m.id,
    status: draft.status === 'scheduled' ? 'scheduled' : 'pending_review',
    reason: draft.reason,
    scheduledAt: draft.scheduledAt,
    channel: draft.channel,
    sendMode: draft.sendMode,
    timezone: draft.contactTimezone,
  };
}

/** minutes (up to 36500) or hours, because the API caps the number at 36500 */
function delayFrom(iso: string): { send_in: number; send_unit: 'minutes' | 'hours' } {
  const minutes = Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 60000));
  return minutes <= 36500
    ? { send_in: minutes, send_unit: 'minutes' }
    : { send_in: Math.ceil(minutes / 60), send_unit: 'hours' };
}

async function logSentInteraction(message: ApiMessage): Promise<void> {
  const body = {
    kind: 'message',
    channel: message.channel,
    notes: message.body.slice(0, 4000),
    occurred_at: new Date().toISOString(),
  };
  const url = `/contacts/${message.contact}/interactions/`;
  try {
    await apiClient.post(url, message.touchpoint ? { ...body, touchpoint: message.touchpoint } : body);
  } catch {
    // The check-in may already be completed: still record that we talked
    await apiClient.post(url, body);
  }
}

async function markSent(id: string): Promise<SentResult> {
  let message = await getMessage(id);
  const before = toDraft(message);
  if (message.status === 'draft' || message.status === 'failed') {
    message = await patchMessage(id, {
      status: 'approved',
      channel: channelToApi(before.channel),
      send_in: 1,
      send_unit: 'minutes',
    });
  }
  await apiClient.post(`/messages/${id}/mark-sent/`);
  await logSentInteraction(message);
  const [contact, messages] = await Promise.all([
    apiClient.get<ApiContact>(`/contacts/${message.contact}/`).then((r) => r.data),
    fetchAllMessages(),
  ]);
  const min = contact.schedule?.interval_min_days ?? 30;
  const max = contact.schedule?.interval_max_days ?? 30;
  const now = Date.now();
  // PRD M18: another message to the same person scheduled within 7 days -> "Keep it or cancel it?"
  const conflict = messages
    .filter(
      (m) =>
        m.id !== id &&
        m.contact === message.contact &&
        m.status === 'approved' &&
        !!m.scheduled_for &&
        new Date(m.scheduled_for).getTime() - now <= 7 * 86400000,
    )
    .sort((a, b) => (a.scheduled_for as string).localeCompare(b.scheduled_for as string))[0];
  return {
    conflict: conflict ? toOpenRef(conflict) : undefined,
    draftId: id,
    contactId: contact.id,
    contactName: contact.name,
    channel: before.channel,
    sentAt: new Date(now).toISOString(),
    healthBefore: before.healthScore,
    healthAfter: computeHealth(0, intervalOf(contact)),
    nextCheckInFrom: new Date(now + min * 86400000).toISOString(),
    nextCheckInTo: new Date(now + max * 86400000).toISOString(),
  };
}

export const realDraftsApi: DraftsApi = {
  async list(status) {
    // Hands over messages whose time has come (approved -> ready to send), so the tabs are up to date
    await releaseDue();
    const [messages, contacts] = await Promise.all([
      fetchAllMessages(),
      // Needed so the Drafts search can also find a draft by the contact's email
      fetchAll<ApiContact>('/contacts/').catch(() => [] as ApiContact[]),
    ]);
    const byId = new Map(contacts.map((c) => [c.id, c]));
    const drafts = messages.map((m) => withContactDetails(toDraft(m), byId.get(m.contact)));
    return status ? drafts.filter((d) => d.status === status) : drafts;
  },

  async get(id) {
    return toDraftWithContact(await getMessage(id));
  },

  async remove(id) {
    await apiClient.delete(`/messages/${id}/`);
  },

  async duplicate(id) {
    const m = await getMessage(id);
    const body: Record<string, unknown> = {
      contact: m.contact,
      purpose: m.purpose,
      tone: m.tone,
      length: m.length,
      body: m.body,
      custom_instruction: m.custom_instruction,
    };
    if (m.channel) body.channel = m.channel;
    const res = await apiClient.post<ApiMessage>('/messages/', body);
    return { id: res.data.id };
  },

  async composeDraft(contactId, input: ComposeDraftInput) {
    const res = await apiClient.post<ApiMessage>('/messages/generate/', {
      contact: contactId,
      purpose: input.purpose,
      tone: input.tone,
      length: input.length,
      custom_instruction: input.instruction.trim(),
      include_history: true,
    });
    // "Send through": remember the chosen app on the draft
    await patchMessage(res.data.id, { channel: channelToApi(input.channel) });
    return { id: res.data.id };
  },

  async update(id, patch) {
    const body: Record<string, unknown> = {};
    if (patch.body !== undefined) body.body = patch.body;
    if (patch.tone !== undefined) body.tone = toneToApi(patch.tone);
    if (patch.channel !== undefined) body.channel = channelToApi(patch.channel);
    try {
      // Keep the contact details: ReviewDraft puts this result in its cache, and Send reads them from there
      return await toDraftWithContact(await patchMessage(id, body));
    } catch (e) {
      // A message that is already waiting to be sent can only be deleted: keep it as it is
      const current = await getMessage(id);
      if (current.status === 'queued') return toDraftWithContact(current);
      throw e;
    }
  },

  async regenerate(id, { tone, length, instruction }) {
    const advisory = tone === 'advisory' ? ADVISORY_NOTE : '';
    await patchMessage(id, {
      tone: toneToApi(tone),
      length,
      custom_instruction: [instruction.trim(), advisory].filter(Boolean).join(' '),
    });
    const res = await apiClient.post<ApiMessage>(`/messages/${id}/regenerate/`, { include_history: true });
    return toDraftWithContact(res.data);
  },

  async messageOptions(contactId) {
    const [contact, memories, messages] = await Promise.all([
      contactsApi.getRaw(contactId),
      fetchAll<{ content: string; category: string }>(`/contacts/${contactId}/memories/`),
      fetchAllMessages(),
    ]);
    const open = messages.find(
      (m) => m.contact === contactId && ['draft', 'approved', 'queued'].includes(m.status),
    );
    const channels = Array.from(
      new Set(
        [
          contact.whatsapp && 'whatsapp',
          contact.telegram && 'telegram',
          contact.phone && 'sms',
          contact.email && 'email',
          contact.messenger && 'messenger',
        ].filter(Boolean) as Channel[],
      ),
    );
    const preferred = channelFromApi(contact.preferred_channel);
    const byCategory = (cat: string) => memories.find((m) => m.category === cat)?.content;
    return {
      contactId: contact.id,
      contactName: contact.name,
      photo: contact.photo,
      preferredChannel: channels.includes(preferred) ? preferred : (channels[0] ?? 'whatsapp'),
      channels: channels.length ? channels : ['whatsapp'],
      openMessage: open ? toOpenRef(open) : undefined,
      openFavor: byCategory('shared_experience'),
      latestEvent: byCategory('life_event'),
      ideas: memories.slice(0, 4).map((m) => m.content),
    };
  },

  async createDraft(contactId, input) {
    const advisory = input.tone === 'advisory' ? ADVISORY_NOTE : '';
    const instruction = [input.note?.trim(), advisory].filter(Boolean).join(' ');
    const res = await apiClient.post<ApiMessage>('/messages/generate/', {
      contact: contactId,
      purpose: purposeFromReason(input.reason),
      tone: toneToApi(input.tone ?? 'warm'),
      length: input.length ?? 'medium',
      custom_instruction: instruction,
      include_history: true,
    });
    return { id: res.data.id };
  },

  async createManualDraft(contactId, input) {
    const res = await apiClient.post<ApiMessage>('/messages/', {
      contact: contactId,
      purpose: 'custom',
      tone: 'casual',
      length: 'medium',
      body: input.content,
      channel: channelToApi(input.channel),
      custom_instruction: MANUAL_MARK,
    });
    return { id: res.data.id };
  },

  // The phone opens the other app itself, so "send" and "mark as sent" are the same step here
  send: markSent,
  markSent,

  async schedule(id, selection) {
    const res = await patchMessage(id, {
      status: 'approved',
      channel: channelToApi(selection.channel),
      ...delayFrom(selection.scheduledAt),
    });
    return toDraft(res);
  },

  async cancelSchedule(id) {
    return toDraft(await patchMessage(id, { status: 'draft' }));
  },
};

export { draftStatusOf, daysSince };
