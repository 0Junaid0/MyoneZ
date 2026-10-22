/**
 * ===============================================================
 *  FILE: types/api.ts
 *  OWNER: Member 1  |  PHASE: 1 (Shared Setup)
 *  WHAT: The shape of the data Member 1's screens get from the
 *        Django backend. Agree these field names with the backend
 *        team before Phase 3 — if they change, only this file and
 *        the api/ files need to change.
 * ===============================================================
 */

import type { Relationship } from '../components/ContactCard';

/** Tokens from POST /api/v1/auth/verify-otp/ and /api/v1/auth/refresh/ (mobile) */
export interface TokenPair {
  access: string;
  refresh: string;
}

/** GET /api/v1/users/me/  (backend has one `name`; authApi.ts splits it into first/last) */
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  timezone?: string;
}

/** Answer of POST /auth/login/ and /auth/register/: a 6-digit code was emailed */
export interface OtpChallenge {
  otp_required: true;
  challenge_id: string;
  detail: string;
  /** only present when the backend uses the console email backend (dev) */
  debug_code?: string;
}

/** POST /api/v1/auth/register/ (then verify the code) */
export interface SignupPayload {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

export type Channel = 'whatsapp' | 'telegram' | 'sms' | 'email' | 'messenger';
export type UpNextStatus = 'overdue' | 'today' | 'upcoming';

/** One row of the Home "Up next" list */
export interface UpNextItem {
  contact_id: string;
  draft_id: string | null; // null = no draft yet, open the contact instead
  name: string;
  avatar_url: string | null;
  relationship: string; // e.g. "Friend", "Mentor"
  reason: string; // e.g. "Birthday", "Check-in"
  channel: Channel;
  last_contacted_days: number | null; // null = never talked
  health_score: number; // 0–100
  status: UpNextStatus;
  days_late?: number; // only when status = "overdue"
  due_date: string; // ISO date, e.g. "2026-10-08"
}

/** One row of the Home "Recently added" list */
export interface RecentContact {
  id: string;
  name: string;
  relationship: Relationship;
  /** 0–100 */
  health_score: number;
  days_since_contact: number;
}

/** GET /api/home/ */
export interface HomeSummary {
  total_contacts: number;
  drafts_waiting: number;
  due_today: number;
  overdue: number;
  later_this_week: number;
  network_health: number; // 0–100, average of all contacts
  unread_notifications: number;
  up_next: UpNextItem[];
  /** Newest contacts first (Home "Recently added") */
  recent_contacts: RecentContact[];
}

/** POST /api/devices/ */
export interface DeviceRegistration {
  token: string;
  platform: 'ios' | 'android';
}
