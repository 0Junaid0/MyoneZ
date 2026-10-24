/**
 * ===============================================================
 *  FILE: api/client.ts
 *  OWNER: Member 1  |  PHASE: 1 (Shared Setup)
 *  WHAT: One Axios instance for the whole app.
 *        - Adds "Authorization: Bearer <token>" to every request
 *        - If the server says 401 (token expired), it gets a new
 *          access token with the refresh token and tries again once
 *        - If refreshing fails, it logs the user out
 *        - getErrorMessage() turns any error into plain English
 *  USED BY: every file in api/ (all members).
 *  SETUP: put the backend address in a file called ".env":
 *         EXPO_PUBLIC_API_URL=http://192.168.0.10:8000
 * ===============================================================
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from './tokenStorage';

// Django API lives under /api/v1 (see backend/config/urls.py)
const baseURL = `${process.env.EXPO_PUBLIC_API_URL ?? ''}/api/v1`;

// Tells the backend this is the mobile app: tokens come in the JSON body, not in cookies
const MOBILE_HEADERS = { 'X-Client': 'mobile' };

export const apiClient = axios.create({
  baseURL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', ...MOBILE_HEADERS },
});

/* ---------- 1. Attach the access token to every request ---------- */
apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* ---------- 2. Log the user out when the session cannot be saved ---------- */
let authFailureHandler: (() => void) | null = null;

/** store/auth.ts calls this once so the client can log the user out */
export function setAuthFailureHandler(handler: () => void): void {
  authFailureHandler = handler;
}

/* ---------- 3. Refresh the token once on 401, then retry ---------- */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) return null;
  try {
    // plain axios here, so this request does not loop through the interceptor
    const response = await axios.post<{ access: string; refresh?: string }>(
      `${baseURL}/auth/refresh/`,
      { refresh },
      { headers: MOBILE_HEADERS, timeout: 15000 },
    );
    await tokenStorage.save(response.data);
    return response.data.access;
  } catch {
    return null;
  }
}

type RetryableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryableConfig | undefined;
    const isAuthRequest = original?.url?.includes('/auth/') ?? false;

    if (error.response?.status === 401 && original && !original._retried && !isAuthRequest) {
      original._retried = true;

      // if many requests fail at once, refresh only one time
      if (!refreshInFlight) {
        refreshInFlight = refreshAccessToken().finally(() => {
          refreshInFlight = null;
        });
      }
      const newToken = await refreshInFlight;

      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      }

      await tokenStorage.clear();
      authFailureHandler?.();
    }

    return Promise.reject(error);
  },
);

/* ---------- 4. Turn any error into a sentence for the user ---------- */
export function isNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response;
}

/** Finds the first human sentence inside strings / arrays / { field: [messages] } */
function firstMessage(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstMessage(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const found = firstMessage(item);
      if (found) return found;
    }
  }
  return null;
}

export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!axios.isAxiosError(error)) {
    // e.g. an Error thrown by a mock API or by our own code
    if (error instanceof Error && error.message.length > 0) return error.message;
    return fallback;
  }
  if (!error.response) return "Can't reach the server. Check your internet connection.";

  // The Django API wraps errors as { error: { detail: ... } }; login/refresh use { detail }
  const data = error.response.data as Record<string, unknown> | undefined;
  if (data && typeof data === 'object') {
    const wrapped = (data.error as { detail?: unknown } | undefined)?.detail;
    const message = firstMessage(wrapped ?? data.detail ?? data);
    if (message) return message;
  }
  return fallback;
}

/** The API pages lists (25 per page). This follows `next` and returns every item. */
export async function fetchAll<T>(
  path: string,
  params: Record<string, unknown> = {},
  maxPages = 20,
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const res = await apiClient.get<{ results: T[]; next: string | null } | T[]>(path, {
      params: { ...params, page },
    });
    if (Array.isArray(res.data)) return res.data;
    items.push(...res.data.results);
    if (!res.data.next) break;
  }
  return items;
}

/** Default export too: Member 2 / 3 / 4 api files write `import client from './client'` */
export default apiClient;
