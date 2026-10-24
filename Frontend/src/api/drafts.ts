import type {
  Channel,
  ComposeDraftInput,
  CreateDraftInput,
  Draft,
  DraftEditable,
  DraftLength,
  DraftStatus,
  MessageOptions,
  ScheduleSelection,
  SentResult,
  Tone,
} from '../types/draft';
import { draftsMockApi } from './mocks/draftsMock';
import { realDraftsApi } from './draftsReal';

/**
 * ===== MOCK vs REAL =====
 * true  -> uses in-memory MOCK data (api/mocks/draftsMock.ts)
 * false -> uses the REAL backend through api/client.ts
 * Set to false once the backend team confirms the endpoints and field names below.
 */
export const USE_MOCK_DRAFTS = false;

export interface DraftsApi {
  list(status?: DraftStatus): Promise<Draft[]>;
  get(id: string): Promise<Draft>;
  update(id: string, patch: DraftEditable): Promise<Draft>;
  /** Writes a new text for the chosen tone, length and direction (custom instruction) */
  regenerate(id: string, options: { tone: Tone; length: DraftLength; instruction: string }): Promise<Draft>;
  /** M15: open draft / scheduled message, open favor, latest life event, idea chips */
  messageOptions(contactId: string): Promise<MessageOptions>;
  /** M15 -> M16: background job, returns the new draft id */
  createDraft(contactId: string, input: CreateDraftInput): Promise<{ id: string }>;
  /** M17: saves the user's own text as a draft, no AI */
  createManualDraft(contactId: string, input: { content: string; channel: Channel }): Promise<{ id: string }>;
  /** "Draft a message": Purpose, Tone, Length, Direction and Send through chosen by the user */
  composeDraft(contactId: string, input: ComposeDraftInput): Promise<{ id: string }>;
  /** "Delete": removes the draft */
  remove(id: string): Promise<void>;
  /** Sent tab -> Reschedule: copies a message (text, tone, length, channel) into a new draft */
  duplicate(id: string): Promise<{ id: string }>;
  /** Same as markSent (the phone opens the other app itself) */
  send(id: string): Promise<SentResult>;
  /** After WhatsApp / SMS, when the user taps "Yes, mark as sent" */
  markSent(id: string): Promise<SentResult>;
  schedule(id: string, selection: ScheduleSelection): Promise<Draft>;
  /** DELETE schedule: the message goes back to To review */
  cancelSchedule(id: string): Promise<Draft>;
}

export const draftsApi: DraftsApi = USE_MOCK_DRAFTS ? draftsMockApi : realDraftsApi;
