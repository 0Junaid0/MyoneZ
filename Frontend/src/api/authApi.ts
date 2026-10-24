/**
 * ===============================================================
 *  FILE: api/authApi.ts
 *  WHAT: Every backend call about the account (Django, /api/v1):
 *        log in / sign up (both send a 6-digit code by email),
 *        verify the code, forgot password, and "who am I".
 *  USED BY: store/auth.ts and pages/ForgotPassword.tsx
 *  NOTE: the backend stores one `name`; here it is split into
 *        first_name / last_name so the screens stay unchanged.
 * ===============================================================
 */
import { apiClient } from './client';
import { uploadPhoto } from './photo';
import type { OtpChallenge, SignupPayload, TokenPair, User } from '../types/api';
import { authMockApi } from './mocks/authMock';

/**
 * true  -> fake login (api/mocks/authMock.ts), no backend needed
 * false -> the REAL Django endpoints below
 */
export const USE_MOCK_AUTH = false;

interface ApiUser {
  id: string;
  email: string;
  name: string;
  timezone?: string;
  photo?: string | null;
}

export function toUser(u: ApiUser): User {
  const parts = (u.name ?? '').trim().split(/\s+/).filter(Boolean);
  return {
    id: u.id,
    email: u.email,
    first_name: parts[0] ?? '',
    last_name: parts.slice(1).join(' '),
    timezone: u.timezone,
    photo: u.photo ?? null,
  };
}

function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export interface AuthApi {
  login(email: string, password: string): Promise<OtpChallenge>;
  register(payload: SignupPayload): Promise<OtpChallenge>;
  verifyOtp(challengeId: string, code: string): Promise<{ tokens: TokenPair; user: User }>;
  /** Step 1 of forgot password: emails a 6-digit code (same answer whether or not the email exists) */
  requestPasswordReset(email: string): Promise<OtpChallenge>;
  /** Step 2: the emailed code + the new password. Signs out every other session. */
  resetPassword(challengeId: string, code: string, newPassword: string): Promise<void>;
  /** Revokes the refresh token on the server and stops pushes to this phone */
  logout(refresh: string | null, deviceToken: string | null): Promise<void>;
  me(): Promise<User>;
  /** Saves a profile photo picked on this phone and returns the updated account */
  updatePhoto(uri: string): Promise<User>;
}

const realAuthApi: AuthApi = {
  async login(email, password) {
    const res = await apiClient.post<OtpChallenge>('/auth/login/', { email, password });
    return res.data;
  },

  async register(payload) {
    const res = await apiClient.post<OtpChallenge>('/auth/register/', {
      email: payload.email,
      password: payload.password,
      name: `${payload.first_name} ${payload.last_name}`.trim(),
      timezone: deviceTimezone(),
    });
    return res.data;
  },

  async verifyOtp(challengeId, code) {
    const res = await apiClient.post<ApiUser & TokenPair>('/auth/verify-otp/', {
      challenge_id: challengeId,
      code,
    });
    const { access, refresh, ...user } = res.data;
    return { tokens: { access, refresh }, user: toUser(user as ApiUser) };
  },

  async requestPasswordReset(email) {
    const res = await apiClient.post<OtpChallenge>('/auth/password-reset/', { email });
    return res.data;
  },

  async resetPassword(challengeId, code, newPassword) {
    await apiClient.post('/auth/password-reset/confirm/', {
      challenge_id: challengeId,
      code,
      new_password: newPassword,
    });
  },

  async logout(refresh, deviceToken) {
    const body: Record<string, string> = {};
    if (refresh) body.refresh = refresh;
    if (deviceToken) body.device_token = deviceToken;
    await apiClient.post('/auth/logout/', body);
  },

  async me() {
    const res = await apiClient.get<ApiUser>('/users/me/');
    return toUser(res.data);
  },

  async updatePhoto(uri: string) {
    const photo = await uploadPhoto('/users/me/', uri);
    const current = await realAuthApi.me();
    return { ...current, photo };
  },
};

export const authApi: AuthApi = USE_MOCK_AUTH ? authMockApi : realAuthApi;
