// components/OfflineBar.tsx  (Owner: Member 4)
// Usage: put <OfflineBar /> once near the top of the app (App.tsx), or on pages that need it.
// It renders nothing while online. Also exports useIsOnline() for pages that need the flag
// (e.g. Member 3's ReviewDraft offline state).
// Needs: npx expo install @react-native-community/netinfo
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { fontSize, fonts, spacing } from '../theme/tokens';

export function useIsOnline(): boolean {
  const [online, setOnline] = useState<boolean>(true);

  useEffect(() => {
    // isInternetReachable is null while unknown: treat that as online.
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    return unsubscribe;
  }, []);

  return online;
}

export type OfflineBarProps = {
  message?: string;
  /** Optional. Pass it when the page already knows (Member 3 pages do). Otherwise the bar checks by itself. */
  isOffline?: boolean;
};

export default function OfflineBar({
  message = "You're offline. Showing saved data.",
  isOffline,
}: OfflineBarProps): React.JSX.Element | null {
  const online = useIsOnline();
  const offline = isOffline ?? !online;
  if (!offline) return null;

  return (
    <View style={styles.bar} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline-outline" size={16} color="#92400E" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: '#FEF3C7',
  },
  text: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: '#92400E' },
});
