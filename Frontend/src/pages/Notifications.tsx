// pages/Notifications.tsx  (Owner: Member 4)
import { showAlert } from '../utils/alert';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';

import { notificationsApi } from '../api/notificationsApi';
import AppHeader from '../components/AppHeader';
import NotificationItem from '../components/NotificationItem';
import type { AppNotification } from '../components/NotificationItem';
import { WEEKDAYS, addDays, isSameDay, startOfDay } from '../components/CalendarStrip';
import { formatTime } from '../components/TimePicker';
import { navigateToTarget } from '../navigation/navigationRef';
// Member 1's components. Check props if they differ.
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';

function timeLabel(createdAt: Date, now: Date): string {
  if (isSameDay(createdAt, now)) {
    const mins = (now.getTime() - createdAt.getTime()) / 60000;
    return mins >= 0 && mins < 1 ? 'now' : formatTime(createdAt);
  }
  if (isSameDay(createdAt, addDays(startOfDay(now), -1))) return 'Yesterday';
  return WEEKDAYS[createdAt.getDay()];
}

export default function Notifications(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await notificationsApi.list());
    } catch {
      setError('Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadCount = items.filter((n) => !n.read).length;

  const { today, earlier } = useMemo(() => {
    const sorted = [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return {
      today: sorted.filter((n) => isSameDay(n.createdAt, now)),
      earlier: sorted.filter((n) => !isSameDay(n.createdAt, now)),
    };
  }, [items, now]);

  const markAllRead = async (): Promise<void> => {
    const previous = items;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await notificationsApi.openAll(previous.filter((n) => !n.read).map((n) => n.id));
    } catch {
      setItems(previous);
      showAlert('Could not update', 'Please try again.');
    }
  };

  const openNotification = (n: AppNotification): void => {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      void notificationsApi.open(n.id).catch(() => undefined);
    }
    navigateToTarget(n.target);
  };

  const renderSection = (label: string, list: AppNotification[]): React.JSX.Element | null => {
    if (list.length === 0) return null;
    return (
      <View style={styles.group}>
        <Text style={styles.sectionLabel}>{label}</Text>
        <View style={styles.card}>
          {list.map((n, i) => (
            <View key={n.id}>
              {i > 0 && <View style={styles.divider} />}
              <NotificationItem notification={n} timeLabel={timeLabel(n.createdAt, now)} onPress={openNotification} />
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderBody = (): React.JSX.Element => {
    if (loading) return <LoadingState />;
    if (error) return <ErrorState message={error} onRetry={load} />;
    if (items.length === 0) {
      return <EmptyState title="You're all caught up" message="New reminders and updates will show up here." />;
    }
    return (
      <>
        {renderSection('Today', today)}
        {renderSection('Earlier', earlier)}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AppHeader
        variant="bar"
        title="Notifications"
        onBack={() => navigation.goBack()}
        rightLabel="Mark all read"
        onRightPress={markAllRead}
        rightDisabled={unreadCount === 0}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {renderBody()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  group: { gap: spacing.sm },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: fontSize.sm,
    letterSpacing: 1,
    color: '#475569',
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: colors.border },
});
