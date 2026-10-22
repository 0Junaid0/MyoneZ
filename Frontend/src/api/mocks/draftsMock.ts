/* ===== MOCK DATA — not real API data. Remove when USE_MOCK_DRAFTS is false. ===== */
import type { DraftsApi } from '../drafts';
import { Channel, Draft, MessageOptions, OpenMessageRef, SentResult, Tone } from '../../types/draft';

const delay = (ms = 350) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const nowIso = () => new Date().toISOString();
const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
const inDays = (d: number) => inHours(d * 24);

interface MockContact {
  id: string;
  name: string;
  phone: string;
  timezone: string;
  channels: Channel[];
  preferred: Channel;
  health: number;
  favor?: string;
  event?: string;
  ideas: string[];
}

const contacts: MockContact[] = [
  { id: 'c1', name: 'Rafi Ahmed', phone: '+8801711000001', timezone: 'Asia/Dhaka', channels: ['whatsapp', 'sms'], preferred: 'whatsapp', health: 34, ideas: ['Ask about his new job', 'Mention the cricket match'] },
  { id: 'c2', name: 'Nusrat Jahan', phone: '+8801711000002', timezone: 'Asia/Dhaka', channels: ['sms', 'telegram'], preferred: 'telegram', health: 58, event: 'Got promoted last month', ideas: ['Congratulate on the promotion'] },
  { id: 'c3', name: 'Tanvir Hasan', phone: '+8801711000003', timezone: 'Asia/Dhaka', channels: ['whatsapp'], preferred: 'whatsapp', health: 76, favor: 'Introduced me to his manager', ideas: [] },
  { id: 'c4', name: 'Maliha Rahman', phone: '+8801711000004', timezone: 'Europe/London', channels: ['sms', 'whatsapp'], preferred: 'sms', health: 81, ideas: ['Ask about the book she recommended'] },
  { id: 'c5', name: 'Sabbir Khan', phone: '+8801711000005', timezone: 'Asia/Kolkata', channels: ['whatsapp', 'sms'], preferred: 'whatsapp', health: 22, ideas: [] },
  // Same ids as the Contacts mock (pages/Contacts.tsx), so "Message" on a contact works
  { id: '4', name: 'Nadia Rahman', phone: '+8801712000000', timezone: 'Asia/Dhaka', channels: ['telegram', 'whatsapp'], preferred: 'telegram', health: 64, favor: 'reviewed your pitch deck in July', event: 'became Director in August', ideas: ['Ask about her conference talk', 'Mention the Raft paper'] },
  { id: '6', name: 'Ayesha Siddiqua', phone: '+8801711000006', timezone: 'Asia/Dhaka', channels: ['sms', 'whatsapp'], preferred: 'sms', health: 76, ideas: [] },
  { id: '7', name: 'Arif Khan', phone: '+8801711000007', timezone: 'Asia/Dhaka', channels: ['whatsapp', 'sms'], preferred: 'whatsapp', health: 88, ideas: ['Plan the Sajek trip'] },
];

/** A clock time `days` from today (local time). Today's 6 PM moves to tomorrow if it has passed. */
const atClock = (days: number, hour: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
  return d.toISOString();
};

const readyAt = new Map<string, number>();
let counter = 100;

const base = (c: MockContact): Pick<Draft, 'contactId' | 'contactName' | 'contactPhone' | 'contactTimezone' | 'contactChannels' | 'healthScore' | 'length'> => ({
  length: 'medium',
  contactId: c.id,
  contactName: c.name,
  contactPhone: c.phone,
  contactTimezone: c.timezone,
  contactChannels: c.channels,
  healthScore: c.health,
});
const byId = (id: string): MockContact => {
  const c = contacts.find((x) => x.id === id);
  if (c) return c;
  // Unknown id (e.g. a contact added in the app): use a plain contact so the sheets still work
  const added: MockContact = { id, name: 'Your contact', phone: '', timezone: 'Asia/Dhaka', channels: ['whatsapp', 'sms'], preferred: 'whatsapp', health: 50, ideas: [] };
  contacts.push(added);
  return added;
};

let store: Draft[] = [
  { ...base(contacts[0]), id: 'd1', body: 'Hey Rafi! It has been a while. How is the new job treating you?', tone: 'warm', channel: 'whatsapp', status: 'pending_review', reason: 'check_in', source: 'ai', generation: 'ready', memoriesUsed: ['New job in October', 'Plays cricket'], daysLate: 6, updatedAt: nowIso() },
  { ...base(contacts[1]), id: 'd2', body: 'Congratulations on the promotion Nusrat! Well deserved.', tone: 'warm', channel: 'telegram', status: 'pending_review', reason: 'congrats', source: 'ai', generation: 'ready', memoriesUsed: ['Got promoted last month'], daysLate: 0, updatedAt: nowIso() },
  { ...base(contacts[2]), id: 'd3', body: 'Hi Tanvir, are we still on for coffee this weekend?', tone: 'casual', channel: 'whatsapp', status: 'pending_review', reason: 'check_in', source: 'ai', generation: 'ready', memoriesUsed: [], daysLate: 0, updatedAt: nowIso() },
  { ...base(contacts[3]), id: 'd4', body: 'Thank you for the book recommendation, I loved it.', tone: 'warm', channel: 'sms', status: 'sent', reason: 'thanks', source: 'ai', generation: 'ready', memoriesUsed: [], daysLate: 0, updatedAt: nowIso() },
  { ...base(contacts[4]), id: 'd5', body: 'Hope your family is doing well. Let us catch up soon.', tone: 'casual', channel: 'whatsapp', status: 'failed', reason: 'check_in', source: 'ai', generation: 'ready', memoriesUsed: [], daysLate: 11, failureReason: 'Number unreachable', updatedAt: nowIso() },
  // M09c Scheduled list (design): Arif, Nadia and Ayesha reminders (v1 has no auto-send)
  { ...base(contacts[7]), id: 'd6', body: 'Happy birthday, Arif! Hope this year finally brings that Sajek trip we keep planning.', tone: 'warm', channel: 'whatsapp', status: 'scheduled', reason: 'birthday', source: 'ai', generation: 'ready', memoriesUsed: ['Sajek trip plan'], daysLate: 0, scheduledAt: atClock(0, 18), sendMode: 'remind', updatedAt: nowIso() },
  { ...base(contacts[5]), id: 'd7', body: 'Hi Nadia, thank you again for reviewing my pitch deck in July. Your notes changed how I tell the story.', tone: 'warm', channel: 'telegram', status: 'scheduled', reason: 'thanks', source: 'ai', generation: 'ready', memoriesUsed: ['Reviewed my pitch deck in July'], daysLate: 0, scheduledAt: atClock(3, 10), sendMode: 'remind', updatedAt: nowIso() },
  { ...base(contacts[6]), id: 'd8', body: 'Hi Ayesha, how did the new project kick-off go?', tone: 'casual', channel: 'sms', status: 'scheduled', reason: 'check_in', source: 'ai', generation: 'ready', memoriesUsed: [], daysLate: 0, scheduledAt: atClock(5, 11), sendMode: 'remind', updatedAt: nowIso() },
];

const find = (id: string): Draft => {
  const draft = store.find((d) => d.id === id);
  if (!draft) throw new Error('Not found');
  return draft;
};

const patch = (id: string, changes: Partial<Draft>): Draft => {
  const next = { ...find(id), ...changes, updatedAt: nowIso() };
  store = store.map((d) => (d.id === id ? next : d));
  return next;
};

const toRef = (d: Draft): OpenMessageRef => ({
  id: d.id,
  status: d.status === 'scheduled' ? 'scheduled' : 'pending_review',
  reason: d.reason,
  scheduledAt: d.scheduledAt,
  channel: d.channel,
  sendMode: d.sendMode,
  timezone: d.contactTimezone,
});

const tonePrefix: Record<Tone, string> = {
  friendly: 'Hi ',
  professional: 'Hello ',
  warm: 'Thinking of you, ',
  casual: 'Hey ',
  formal: 'Dear ',
  advisory: 'A quick thought for you, ',
};

const finishSend = (id: string): SentResult => {
  const before = find(id);
  const after = Math.min(100, before.healthScore + 8);
  const conflict = store.find(
    (d) => d.contactId === before.contactId && d.id !== id && d.status === 'scheduled' && d.scheduledAt && new Date(d.scheduledAt).getTime() < Date.now() + 7 * 86400_000,
  );
  patch(id, { status: 'sent', scheduledAt: undefined, failureReason: undefined, healthScore: after, daysLate: 0 });
  return {
    draftId: id,
    contactId: before.contactId,
    contactName: before.contactName,
    channel: before.channel,
    sentAt: nowIso(),
    healthBefore: before.healthScore,
    healthAfter: after,
    nextCheckInFrom: inDays(25),
    nextCheckInTo: inDays(35),
    conflict: conflict ? toRef(conflict) : undefined,
  };
};

export const draftsMockApi: DraftsApi = {
  async list(status) {
    await delay();
    const rows = status ? store.filter((d) => d.status === status) : [...store];
    return rows.sort((a, b) => b.daysLate - a.daysLate); // overdue first
  },
  async get(id) {
    await delay(200);
    const draft = find(id);
    const ready = readyAt.get(id);
    if (draft.generation === 'pending' && ready && Date.now() >= ready) {
      const first = draft.contactName.split(' ')[0];
      return patch(id, { generation: 'ready', body: `${tonePrefix[draft.tone]}${first}, it has been a while. How have you been?` });
    }
    return draft;
  },
  async update(id, changes) {
    await delay(200);
    return patch(id, changes);
  },
  async regenerate(id, { tone, length, instruction }) {
    await delay(900);
    const first = find(id).contactName.split(' ')[0];
    const extra = length === 'short' ? '' : length === 'long' ? ' I would love to catch up properly soon, maybe over coffee this week.' : ' Hope all is well.';
    const note = instruction.trim() ? ` ${instruction.trim()}` : '';
    return patch(id, { tone, length, reasonNote: instruction.trim() || undefined, body: `${tonePrefix[tone]}${first}, it has been too long. How have you been?${extra}${note}` });
  },
  async messageOptions(contactId) {
    await delay(250);
    const c = byId(contactId);
    const open = store.find((d) => d.contactId === contactId && (d.status === 'pending_review' || d.status === 'scheduled'));
    const options: MessageOptions = {
      contactId: c.id,
      contactName: c.name,
      preferredChannel: c.preferred,
      channels: c.channels,
      openMessage: open ? toRef(open) : undefined,
      openFavor: c.favor,
      latestEvent: c.event,
      ideas: c.ideas,
    };
    return options;
  },
  async createDraft(contactId, input) {
    await delay(300);
    const c = byId(contactId);
    counter += 1;
    const id = `d${counter}`;
    store = [
      { ...base(c), id, body: '', tone: input.tone ?? 'warm', channel: c.preferred, status: 'pending_review', reason: input.reason, reasonNote: input.note, source: 'ai', generation: 'pending', memoriesUsed: c.favor ? [c.favor] : [], daysLate: 0, updatedAt: nowIso() },
      ...store,
    ];
    readyAt.set(id, Date.now() + 1800); // MOCK: the background job finishes after ~2 seconds
    return { id };
  },
  async createManualDraft(contactId, input) {
    await delay(300);
    const c = byId(contactId);
    counter += 1;
    const id = `d${counter}`;
    store = [
      { ...base(c), id, body: input.content, tone: 'warm', channel: input.channel, status: 'pending_review', reason: 'other', source: 'manual', generation: 'ready', memoriesUsed: [], daysLate: 0, updatedAt: nowIso() },
      ...store,
    ];
    return { id };
  },
  async composeDraft(contactId, input) {
    await delay(300);
    const c = byId(contactId);
    counter += 1;
    const id = `d${counter}`;
    const reason = input.purpose === 'birthday' ? 'birthday' : input.purpose === 'gratitude' ? 'thanks' : input.purpose === 'congratulations' ? 'congrats' : 'check_in';
    store = [
      { ...base(c), id, body: '', tone: 'warm', channel: input.channel, status: 'pending_review', reason, reasonNote: input.instruction || undefined, source: 'ai', generation: 'pending', memoriesUsed: [], daysLate: 0, updatedAt: nowIso() },
      ...store,
    ];
    readyAt.set(id, Date.now() + 1800);
    return { id };
  },
  async remove(id) {
    await delay(200);
    store = store.filter((d) => d.id !== id);
  },
  async send(id) {
    await delay(500);
    return finishSend(id);
  },
  async markSent(id) {
    await delay(300);
    return finishSend(id);
  },
  async schedule(id, selection) {
    await delay();
    return patch(id, { channel: selection.channel, scheduledAt: selection.scheduledAt, sendMode: selection.sendMode, status: 'scheduled' });
  },
  async cancelSchedule(id) {
    await delay();
    return patch(id, { status: 'pending_review', scheduledAt: undefined, sendMode: undefined });
  },
};
