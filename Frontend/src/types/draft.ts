/** 'email' is shown as "Gmail" in the app; the backend calls it "email" */
export type Channel = 'whatsapp' | 'sms' | 'telegram' | 'email' | 'messenger';
/** The contact form can also leave the preferred channel as "Not set" */
export type ContactChannel = Channel | 'none';
/**
 * Draft screen: Friendly, Warm, Casual, Professional (same as the backend).
 * Contact form / Settings still offer Formal and Advisory.
 */
export type Tone = 'friendly' | 'warm' | 'casual' | 'professional' | 'formal' | 'advisory';
/** Short, Medium or Long, picked before (re)writing a draft */
export type DraftLength = 'short' | 'medium' | 'long';
/** Same values as the backend `status` filter (PRD section 10) */
export type DraftStatus = 'pending_review' | 'scheduled' | 'sent' | 'failed';
/**
 * Version 1 is link-only: at the scheduled time the user gets a reminder and sends
 * from their own WhatsApp / SMS / Telegram. Auto-send (Telegram bot, SMS gateway)
 * was removed until the backend can really send; add 'auto' back here then.
 */
export type SendMode = 'remind';
export type DraftReason = 'check_in' | 'reconnect' | 'birthday' | 'thanks' | 'congrats' | 'other';
export type DraftSource = 'ai' | 'manual';
/** AI drafts are written by a background job, so a draft can still be "pending" */
export type GenerationState = 'pending' | 'ready' | 'failed';

export interface Draft {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone?: string;
  contactAvatarUrl?: string;
  /** WhatsApp number (E.164) when it differs from the phone */
  contactWhatsapp?: string;
  /** Telegram @username or phone number */
  contactTelegram?: string;
  /** Needed to send by Gmail */
  contactEmail?: string;
  /** Messenger username, needed to send by Messenger */
  contactMessenger?: string;
  /** Timezone of the contact (IANA). Scheduling uses this. */
  contactTimezone: string;
  /** Only the channels this person has */
  contactChannels: Channel[];
  /** 0-100 */
  healthScore: number;
  body: string;
  tone: Tone;
  length: DraftLength;
  channel: Channel;
  status: DraftStatus;
  reason: DraftReason;
  reasonNote?: string;
  source: DraftSource;
  generation: GenerationState;
  /** "Written from" chips: memories used for the draft */
  memoriesUsed: string[];
  /** Positive when the check-in is overdue, e.g. 3 = 3 days late */
  daysLate: number;
  /** ISO string */
  scheduledAt?: string;
  sendMode?: SendMode;
  failureReason?: string;
  /** ISO string */
  updatedAt: string;
}

export interface ScheduleSelection {
  channel: Channel;
  /** ISO string, always in the future */
  scheduledAt: string;
  /** Contact timezone the time was picked in */
  timezone: string;
  sendMode: SendMode;
}

export type DraftEditable = Partial<Pick<Draft, 'body' | 'tone' | 'channel'>>;

/** A message already open for the same person (shown in M15 and M18) */
export interface OpenMessageRef {
  id: string;
  status: 'pending_review' | 'scheduled';
  reason: DraftReason;
  /** ISO string, for scheduled messages */
  scheduledAt?: string;
  channel: Channel;
  sendMode?: SendMode;
  timezone?: string;
}

/** Reply of GET /contacts/{id}/message-options/ (M15, M17) */
export interface MessageOptions {
  contactId: string;
  contactName: string;
  photo?: string | null;
  preferredChannel: Channel;
  channels: Channel[];
  openMessage?: OpenMessageRef;
  /** Open favor, shown on "Say thanks". Hidden when absent. */
  openFavor?: string;
  /** Latest life event, shown on "Congratulate". Hidden when absent. */
  latestEvent?: string;
  /** Idea chips for "Write my own". Hidden when empty. */
  ideas: string[];
}

export interface CreateDraftInput {
  reason: DraftReason;
  note?: string;
  tone?: Tone;
  length?: DraftLength;
}

/** "Draft a message" form (Purpose, Tone, Length, Direction, Send through, Send in) */
export type ComposePurpose = 'check_in' | 'reconnect' | 'birthday' | 'congratulations' | 'gratitude';
export type ComposeTone = 'friendly' | 'warm' | 'casual' | 'professional';
export type ComposeLength = 'short' | 'medium' | 'long';
export type SendUnit = 'minutes' | 'hours' | 'days';

export interface ComposeDraftInput {
  purpose: ComposePurpose;
  tone: ComposeTone;
  length: ComposeLength;
  /** Free text, e.g. "Mention their new role" */
  instruction: string;
  channel: Channel;
  /** Optional: "Send in" number + unit. Shown again in the Schedule sheet. */
  sendIn?: number;
  sendUnit?: SendUnit;
}

/** Reply of send / mark-sent (PRD: includes new health, next check-in and nearby scheduled message) */
export interface SentResult {
  draftId: string;
  contactId: string;
  contactName: string;
  channel: Channel;
  /** ISO string */
  sentAt: string;
  healthBefore: number;
  healthAfter: number;
  /** ISO strings: the next check-in window */
  nextCheckInFrom: string;
  nextCheckInTo: string;
  /** Another message to the same person scheduled within 7 days */
  conflict?: OpenMessageRef;
}
