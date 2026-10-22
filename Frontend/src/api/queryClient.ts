// api/queryClient.ts  (added by Member 4: React Query offline cache + network state)
// - Online/offline state comes from NetInfo, so queries pause offline and resume when back online.
// - Successful query data is saved to AsyncStorage (24h), so screens still show saved data offline.
// - Call clearQueryCache() on logout so the next user never sees the previous user's cached data.
//   (The auth token itself is NOT stored here; it stays in SecureStore.)
// Needs: npx expo install @react-native-async-storage/async-storage @react-native-community/netinfo
//        npm i @tanstack/react-query @tanstack/react-query-persist-client @tanstack/query-async-storage-persister
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

const HOUR = 60 * 60 * 1000;

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    // isInternetReachable is null while unknown: treat that as online.
    setOnline(state.isConnected !== false && state.isInternetReachable !== false);
  }),
);

// When the phone brings the app back (e.g. after WhatsApp), screens refetch their data.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (status) => handleFocus(status === 'active'));
    return () => subscription.remove();
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 24 * HOUR, // must be >= the persist maxAge below
      retry: 2,
      networkMode: 'offlineFirst', // serve cache first, fetch when online
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'prm-query-cache',
});

export const PERSIST_MAX_AGE = 24 * HOUR;

export async function clearQueryCache(): Promise<void> {
  queryClient.clear();
  await queryPersister.removeClient();
}
