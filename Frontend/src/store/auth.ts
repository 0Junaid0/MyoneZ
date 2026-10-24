/**
 * ===============================================================
 *  FILE: store/auth.ts
 *  OWNER: Member 1  |  PHASE: 1 (Shared Setup)
 *  WHAT: Remembers whether the user is logged in, and who they are.
 *        status = 'loading'   → app just opened, checking tokens
 *        status = 'signedOut' → show Login / Signup screens
 *        status = 'signedIn'  → show the 5 tabs
 *  USED BY: App.tsx (Member 4) to pick which screens to show,
 *           Login, Signup, Home (Member 1), Settings log out (Member 4).
 *
 *  HOW MEMBER 4 USES IT IN App.tsx:
 *    const status = useAuthStore((s) => s.status);
 *    useEffect(() => { useAuthStore.getState().restoreSession(); }, []);
 *    status === 'signedIn' ? <AppStack /> : <AuthStack />
 *  Because App.tsx switches screens on its own, Login and Signup
 *  do not need to call navigate('Home') after success.
 * ===============================================================
 */
import { create } from 'zustand';
import { authApi } from '../api/authApi';
import { deviceApi } from '../api/deviceApi';
import { isNetworkError, setAuthFailureHandler } from '../api/client';
import { tokenStorage } from '../api/tokenStorage';
import { clearQueryCache } from '../api/queryClient';
import type { OtpChallenge, SignupPayload, User } from '../types/api';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

/** A 6-digit code was emailed and we are waiting for the user to type it (pages/VerifyOtp.tsx) */
export interface PendingOtp {
  challengeId: string;
  email: string;
  detail: string;
  /** dev only: the backend prints the code and returns it */
  debugCode?: string;
}

// how to ask the backend for a fresh code (set by login() / register())
let resendRequest: (() => Promise<OtpChallenge>) | null = null;

function toPending(challenge: OtpChallenge, email: string): PendingOtp {
  return {
    challengeId: challenge.challenge_id,
    email,
    detail: challenge.detail,
    debugCode: challenge.debug_code,
  };
}

interface AuthState {
  status: AuthStatus;
  user: User | null;
  /** set after login()/register() until the emailed code is verified */
  pending: PendingOtp | null;
  /** Call once when the app opens */
  restoreSession: () => Promise<void>;
  /** Step 1: checks email + password and emails a code. Sets `pending`. Throws if wrong. */
  login: (email: string, password: string) => Promise<void>;
  /** Step 1 of sign up: emails a code. The account is created when the code is verified. */
  register: (payload: SignupPayload) => Promise<void>;
  /** Step 2: checks the code, saves the tokens and signs the user in */
  verifyOtp: (code: string) => Promise<void>;
  /** Sends a new code */
  resendOtp: () => Promise<void>;
  /** Back to the Log in / Sign up screens */
  cancelOtp: () => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  pending: null,

  restoreSession: async () => {
    const { access, refresh } = await tokenStorage.load();
    if (!access && !refresh) {
      set({ status: 'signedOut', user: null });
      return;
    }
    try {
      const user = await authApi.me();
      set({ status: 'signedIn', user });
    } catch (error) {
      if (isNetworkError(error)) {
        // offline: keep the user logged in, show saved data
        set({ status: 'signedIn' });
      } else {
        await tokenStorage.clear();
        set({ status: 'signedOut', user: null });
      }
    }
  },

  login: async (email, password) => {
    const normalized = email.trim().toLowerCase();
    const request = () => authApi.login(normalized, password);
    const challenge = await request();
    resendRequest = request;
    set({ pending: toPending(challenge, normalized) });
  },

  register: async (payload) => {
    const clean = {
      ...payload,
      email: payload.email.trim().toLowerCase(),
      first_name: payload.first_name.trim(),
      last_name: payload.last_name.trim(),
    };
    const request = () => authApi.register(clean);
    const challenge = await request();
    resendRequest = request;
    set({ pending: toPending(challenge, clean.email) });
  },

  verifyOtp: async (code) => {
    const pending = get().pending;
    if (!pending) throw new Error('Please log in again.');
    const { tokens, user } = await authApi.verifyOtp(pending.challengeId, code.trim());
    await tokenStorage.save(tokens);
    resendRequest = null;
    set({ status: 'signedIn', user, pending: null });
  },

  resendOtp: async () => {
    const pending = get().pending;
    if (!pending || !resendRequest) throw new Error('Please log in again.');
    const challenge = await resendRequest();
    set({ pending: toPending(challenge, pending.email) });
  },

  cancelOtp: () => {
    resendRequest = null;
    set({ pending: null });
  },

  logout: async () => {
    // Revoke the refresh token on the server and stop pushes to this phone.
    // Best effort: offline or an expired session must still log out locally.
    try {
      await authApi.logout(tokenStorage.getRefresh(), deviceApi.currentToken());
    } catch {
      // ignore
    }
    deviceApi.forget();
    await tokenStorage.clear();
    resendRequest = null;
    set({ status: 'signedOut', user: null, pending: null });
    // the next user must never see the old user's cached data
    await clearQueryCache();
  },
}));

// When the refresh token is no longer valid, api/client.ts calls this.
setAuthFailureHandler(() => {
  useAuthStore.setState({ status: 'signedOut', user: null });
  void clearQueryCache();
});
