/**
 * ===============================================================
 *  FILE: api/emailApi.ts
 *  WHAT: The user's own sending email (SMTP) settings.
 *        GET / PATCH /api/v1/users/me/email/   read and save
 *        POST        /api/v1/users/me/email/   send a test email
 *  USED BY: pages/EmailSettings.tsx
 * ===============================================================
 */
import { apiClient } from './client';

export type EmailSecurity = 'tls' | 'ssl' | 'none';

export interface EmailSettings {
  from_email: string;
  host: string;
  port: number;
  username: string;
  security: EmailSecurity;
  /** The password itself is never sent back; only whether one is saved */
  password_set: boolean;
}

export interface EmailSettingsInput {
  from_email: string;
  host: string;
  port: number;
  username: string;
  security: EmailSecurity;
  /** Left out when the user did not type a new one */
  password?: string;
}

export const emailApi = {
  async get(): Promise<EmailSettings> {
    return (await apiClient.get<EmailSettings>('/users/me/email/')).data;
  },

  async save(input: EmailSettingsInput): Promise<EmailSettings> {
    return (await apiClient.patch<EmailSettings>('/users/me/email/', input)).data;
  },

  /** "Send test": sends a test email to the sending address using the saved settings */
  async sendTest(): Promise<void> {
    await apiClient.post('/users/me/email/');
  },
};
