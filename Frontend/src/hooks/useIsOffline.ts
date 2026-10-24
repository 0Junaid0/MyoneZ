import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/** Small network hook for Member 3 screens. If Member 4 ships a shared one, swap this import. */
export function useIsOffline(): boolean {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false || state.isInternetReachable === false);
    });
    return unsubscribe;
  }, []);
  return offline;
}
