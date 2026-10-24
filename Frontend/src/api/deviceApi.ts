/**
 * ===============================================================
 *  FILE: api/deviceApi.ts
 *  OWNER: Member 1  |  PHASE: 3 (Push notifications)
 *  WHAT: Sends this phone's push token to the backend, so the
 *        backend knows where to send "draft ready" notifications.
 *        Remembers the token so log out can tell the backend to
 *        stop pushing to this phone.
 *  BACKEND: POST /api/v1/devices/ { token, platform }
 *           DELETE /api/v1/devices/ { token }
 *  USED BY: notifications/push.ts, store/auth.ts (log out)
 * ===============================================================
 */
import { apiClient } from './client';
import type { DeviceRegistration } from '../types/api';

let registeredToken: string | null = null;

export const deviceApi = {
  async register(device: DeviceRegistration): Promise<void> {
    await apiClient.post('/devices/', device);
    registeredToken = device.token;
  },

  /** The push token saved on the server in this session (null if none) */
  currentToken(): string | null {
    return registeredToken;
  },

  forget(): void {
    registeredToken = null;
  },
};
