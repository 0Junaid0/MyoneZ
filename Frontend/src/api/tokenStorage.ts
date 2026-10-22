/**
 * ===============================================================
 *  FILE: api/tokenStorage.ts
 *  OWNER: Member 1  |  PHASE: 1 (Shared Setup)
 *  WHAT: Saves the login tokens safely in the phone's SecureStore
 *        (never in AsyncStorage, never in code). Also keeps a copy
 *        in memory so every API request can read it quickly.
 *  USED BY: api/client.ts and store/auth.ts only.
 * ===============================================================
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// SecureStore does not exist on web (npx expo start --web). There the tokens
// live only in memory, so a page reload logs you out. Phones use SecureStore.
const isWeb = Platform.OS === 'web';
const store = {
  getItemAsync: (key: string) => (isWeb ? Promise.resolve(null) : SecureStore.getItemAsync(key)),
  setItemAsync: (key: string, value: string) => (isWeb ? Promise.resolve() : SecureStore.setItemAsync(key, value)),
  deleteItemAsync: (key: string) => (isWeb ? Promise.resolve() : SecureStore.deleteItemAsync(key)),
};

const ACCESS_KEY = 'prm_access_token';
const REFRESH_KEY = 'prm_refresh_token';

let accessCache: string | null = null;
let refreshCache: string | null = null;

export const tokenStorage = {
  /** Read both tokens from SecureStore when the app starts */
  async load(): Promise<{ access: string | null; refresh: string | null }> {
    accessCache = await store.getItemAsync(ACCESS_KEY);
    refreshCache = await store.getItemAsync(REFRESH_KEY);
    return { access: accessCache, refresh: refreshCache };
  },

  getAccess(): string | null {
    return accessCache;
  },

  getRefresh(): string | null {
    return refreshCache;
  },

  /** Save after log in, or after the access token is refreshed */
  async save(tokens: { access: string; refresh?: string }): Promise<void> {
    accessCache = tokens.access;
    await store.setItemAsync(ACCESS_KEY, tokens.access);
    if (tokens.refresh) {
      refreshCache = tokens.refresh;
      await store.setItemAsync(REFRESH_KEY, tokens.refresh);
    }
  },

  /** Remove everything on log out */
  async clear(): Promise<void> {
    accessCache = null;
    refreshCache = null;
    await store.deleteItemAsync(ACCESS_KEY);
    await store.deleteItemAsync(REFRESH_KEY);
  },
};
