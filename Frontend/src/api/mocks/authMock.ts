// MOCK: lets the app run before the Django backend is ready.
// Any email + password logs in; the code screen accepts any 6 digits.
// Turn off with USE_MOCK_AUTH in api/authApi.ts.
import type { OtpChallenge, SignupPayload, TokenPair, User } from '../../types/api';
import type { AuthApi } from '../authApi';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let mockUser: User = {
  id: 'u1',
  email: 'nusrat@example.com',
  first_name: 'Nusrat',
  last_name: 'Jahan',
  timezone: 'Asia/Dhaka',
};

const challenge = (email: string): OtpChallenge => ({
  otp_required: true,
  challenge_id: 'mock-challenge',
  detail: `We sent a 6-digit code to ${email}. (Mock: any 6 digits work.)`,
  debug_code: '123456',
});

export const authMockApi: AuthApi = {
  async login(email) {
    await wait(400);
    mockUser = { ...mockUser, email };
    return challenge(email);
  },

  async register(payload: SignupPayload) {
    await wait(400);
    mockUser = { ...mockUser, email: payload.email, first_name: payload.first_name, last_name: payload.last_name };
    return challenge(payload.email);
  },

  async verifyOtp() {
    await wait(300);
    const tokens: TokenPair = { access: 'mock-access-token', refresh: 'mock-refresh-token' };
    return { tokens, user: mockUser };
  },

  async requestPasswordReset(email) {
    await wait(400);
    return challenge(email);
  },
  async resetPassword() {
    await wait(300);
  },
  async logout() {
    await wait(100);
  },

  async me() {
    await wait(150);
    return mockUser;
  },

  async updatePhoto(uri: string) {
    await wait(200);
    mockUser = { ...mockUser, photo: uri };
    return mockUser;
  },
};
