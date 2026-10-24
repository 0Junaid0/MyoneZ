// STEP: PHASE 3 · Page-step 2 · M07 Drafts (+ M09c Scheduled list)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { draftsApi } from '../api/drafts';
import AppHeader from '../components/AppHeader';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import MessageCard, { MessageCardAction } from '../components/MessageCard';
import ScheduleSheet from '../components/ScheduleSheet';
import SentSheet from '../components/SentSheet';
import SearchBar from '../components/SearchBar';
import Toast, { useToast } from '../components/Toast';
import { useIsOffline } from '../hooks/useIsOffline';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';
import { Draft, DraftStatus, ScheduleSelection } from '../types/draft';
import type { DraftsNavParams } from '../types/navigation';
import type { TabParamList } from '../navigation/types';
import { getErrorMessage } from '../utils/errors';
import { describeWhen, isLockedSchedule } from '../utils/time';

const TABS: { status: DraftStatus; label: string }[] = [
  { status: 'pending_review', label: 'To review' },
  { status: 'scheduled', label: 'Scheduled' },
  { status: 'sent', label: 'Sent' },
  { status: 'failed', label: 'Failed' },
];

const EMPTY_COPY: Record<DraftStatus, { title: string; description: string }> = {
  pending_review: { title: 'All caught up — nothing to review', description: 'New drafts for your contacts will show up here.' },
  scheduled: { title: 'Nothing scheduled', description: 'Schedule a draft from the review screen and it will wait here.' },
  sent: { title: 'No sent messages yet', description: 'Messages you confirm as sent will be listed here.' },
  failed: { title: 'No failed messages', description: 'Messages that could not be delivered will show up here, with a reason and Retry.' },
};

function sortForTab(rows: Draft[], status: DraftStatus): Draft[] {
  const copy = [...rows];
  if (status === 'scheduled') {
    return copy.sort((a, b) => new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime());
  }
  // overdue first
  return copy.sort((a, b) => b.daysLate - a.daysLate);
}

/** Home / push notifications open a tab with { tab: 'review' | 'failed' | ... } */
function tabFromParam(tab: string | undefined): DraftStatus | null {
  if (tab === 'review' || tab === 'pending_review') return 'pending_review';
  if (tab === 'scheduled' || tab === 'sent' || tab === 'failed') return tab;
  return null;
}

/** Blue note at the top of the Scheduled tab (M09c) */
function ScheduledInfo(): React.JSX.Element {
  return (
    <View style={styles.info}>
      <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
      <Text style={styles.infoText}>
        At the set time you get a <Text style={styles.infoBold}>reminder</Text>, then one tap opens your own app with the
        message ready to send.
      </Text>
    </View>
  );
}

export default function Drafts(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<DraftsNavParams>>();
  const queryClient = useQueryClient();
  const isOffline = useIsOffline();
  const { toastProps, showToast } = useToast();

  const route = useRoute<RouteProp<TabParamList, 'Drafts'>>();
  const requestedTab = tabFromParam(route.params?.tab);
  const [activeTab, setActiveTab] = useState<DraftStatus>(requestedTab ?? 'pending_review');
  useEffect(() => {
    if (requestedTab) setActiveTab(requestedTab);
  }, [requestedTab, route.params]);
  const [cancelTarget, setCancelTarget] = useState<Draft | null>(null);
  const [timeTarget, setTimeTarget] = useState<Draft | null>(null);
  // Sent tab: the message being looked at, and the temporary copy being rescheduled
  const [sentTarget, setSentTarget] = useState<Draft | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['drafts'],
    queryFn: () => draftsApi.list(),
  });

  // Tabs stay mounted: reload whenever the screen comes back into view
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  // Re-check every 10 s: the "locked in the last minute" state and the hand-over of a due
  // reminder must update on their own, not only when the screen is reopened.
  const [, setTick] = useState<number>(0);
  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
      const now = Date.now();
      const hasDue = (queryClient.getQueryData<Draft[]>(['drafts']) ?? []).some(
        (d) => d.status === 'scheduled' && d.scheduledAt && new Date(d.scheduledAt).getTime() <= now,
      );
      if (hasDue) void refetch();
    }, 10_000);
    return () => clearInterval(id);
  }, [queryClient, refetch]);

  const counts = useMemo(() => {
    const result: Record<DraftStatus, number> = { pending_review: 0, scheduled: 0, sent: 0, failed: 0 };
    (data ?? []).forEach((d) => {
      result[d.status] += 1;
    });
    return result;
  }, [data]);

  const visibleDrafts = useMemo(() => {
    const q = search.trim().toLowerCase();
    // "01712 000000" should also find "+8801712000000"
    const qDigits = q.replace(/\D/g, '').replace(/^0+/, '');
    const matches = (d: Draft): boolean => {
      if (!q) return true;
      const text = [d.contactName, d.contactEmail, d.contactPhone, d.contactWhatsapp, d.contactTelegram, d.contactMessenger, d.body]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(q) || (qDigits.length >= 3 && text.replace(/\D/g, '').includes(qDigits));
    };
    return sortForTab((data ?? []).filter((d) => d.status === activeTab && matches(d)), activeTab);
  }, [data, activeTab, search]);

  const refreshDrafts = useCallback(() => queryClient.invalidateQueries({ queryKey: ['drafts'] }), [queryClient]);

  const cancelMutation = useMutation({
    mutationFn: (id: string) => draftsApi.cancelSchedule(id),
    onSuccess: () => {
      showToast('Schedule cancelled');
      refreshDrafts();
    },
    onError: (e) => showToast(getErrorMessage(e), 'error'),
    onSettled: () => setCancelTarget(null),
  });

  const scheduleMutation = useMutation({
    mutationFn: ({ id, selection }: { id: string; selection: ScheduleSelection }) => draftsApi.schedule(id, selection),
    onSuccess: (draft) => {
      showToast(`Scheduled for ${describeWhen(draft.scheduledAt ?? new Date(), draft.contactTimezone).toLowerCase()}`);
      setTimeTarget(null);
      if (rescheduleId && draft.id === rescheduleId) {
        setRescheduleId(null);
        setActiveTab('scheduled');
      }
      refreshDrafts();
    },
    onError: (e) => showToast(getErrorMessage(e), 'error'),
  });

  // Reschedule a sent message: copy it into a new draft, then pick a new date and time for the copy
  const rescheduleMutation = useMutation({
    mutationFn: async (sent: Draft) => {
      const { id } = await draftsApi.duplicate(sent.id);
      return draftsApi.get(id);
    },
    onSuccess: (copy) => {
      setSentTarget(null);
      setRescheduleId(copy.id);
      setTimeTarget(copy);
    },
    onError: (e) => showToast(getErrorMessage(e), 'error'),
  });

  // Closing the date picker without confirming: remove the unused copy
  const closeTimeSheet = () => {
    if (timeTarget && rescheduleId === timeTarget.id) {
      void draftsApi.remove(rescheduleId).catch(() => undefined).finally(() => refreshDrafts());
      setRescheduleId(null);
    }
    setTimeTarget(null);
  };

  /** Blocks write actions while offline with a clear message. */
  const guardOnline = (action: () => void) => {
    if (isOffline) {
      showToast("You're offline. Reconnect to do this.", 'warning');
      return;
    }
    action();
  };

  const openReview = (draft: Draft) => navigation.navigate('ReviewDraft', { draftId: draft.id, mode: 'review' });

  const actionsFor = (draft: Draft): MessageCardAction[] => {
    if (draft.status === 'scheduled') {
      const locked = isLockedSchedule(draft.scheduledAt);
      return [
        { label: 'Change time', disabled: locked, onPress: () => guardOnline(() => setTimeTarget(draft)) },
        { label: 'Send now', disabled: locked, onPress: () => openReview(draft) },
        { label: 'Cancel', destructive: true, disabled: locked, onPress: () => guardOnline(() => setCancelTarget(draft)) },
      ];
    }
    if (draft.status === 'sent') {
      return [{ label: 'Reschedule', onPress: () => guardOnline(() => rescheduleMutation.mutate(draft)) }];
    }
    if (draft.status === 'failed') {
      // Retry opens the review screen: the user presses Send again (WhatsApp/SMS need a tap anyway)
      return [{ label: 'Retry', onPress: () => openReview(draft) }];
    }
    return [];
  };

  const noteFor = (draft: Draft): string | undefined =>
    draft.status === 'scheduled' && isLockedSchedule(draft.scheduledAt) ? 'Sends in under a minute, so it can no longer be changed.' : undefined;

  const renderBody = () => {
    if (isLoading) return <LoadingState message="Loading your drafts" />;
    if (isError) return <ErrorState message={getErrorMessage(error, "Couldn't load drafts.")} onRetry={() => refetch()} />;
    return (
      <FlatList
        data={visibleDrafts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, visibleDrafts.length === 0 && styles.listEmpty]}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { void refetch(); }} tintColor={colors.primary} />}
        ListHeaderComponent={activeTab === 'scheduled' && visibleDrafts.length > 0 ? <ScheduledInfo /> : undefined}
        renderItem={({ item, index }) => (
          <MessageCard
            draft={item}
            onPress={() => (item.status === 'sent' ? setSentTarget(item) : openReview(item))}
            actions={actionsFor(item)}
            note={noteFor(item)}
            highlighted={activeTab === 'scheduled' && index === 0}
          />
        )}
        ListEmptyComponent={
          search.trim() ? (
            <EmptyState title="No matches" description="Try a different name, email or number." />
          ) : (
            <EmptyState title={EMPTY_COPY[activeTab].title} description={EMPTY_COPY[activeTab].description} />
          )
        }
      />
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AppHeader title="Drafts" subtitle="Nothing is sent until you approve it." />
      <View style={styles.search}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search name, email, or number" />
      </View>
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
          accessibilityRole="tablist"
        >
          {TABS.map((tab) => {
            const selected = tab.status === activeTab;
            const isFailed = tab.status === 'failed';
            const count = counts[tab.status];
            return (
              <Pressable
                key={tab.status}
                onPress={() => setActiveTab(tab.status)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${tab.label}, ${count}`}
                style={[styles.tab, isFailed && styles.tabFailed, selected && styles.tabSelected]}
              >
                <Text
                  style={[styles.tabLabel, isFailed && styles.tabLabelFailed, selected && styles.tabLabelSelected]}
                  numberOfLines={1}
                >
                  {tab.label}
                  {count > 0 ? ` ${count}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {renderBody()}

      <ConfirmDialog
        visible={cancelTarget !== null}
        title="Cancel this scheduled message?"
        message={cancelTarget ? `The message to ${cancelTarget.contactName} won't be sent. It moves back to To review.` : ''}
        confirmLabel="Cancel schedule"
        cancelLabel="Keep schedule"
        destructive
        onConfirm={() => cancelTarget && cancelMutation.mutate(cancelTarget.id)}
        onCancel={() => setCancelTarget(null)}
      />

      {timeTarget ? (
        <ScheduleSheet
          visible
          draftId={timeTarget.id}
          timezone={timeTarget.contactTimezone}
          channels={timeTarget.contactChannels}
          initialChannel={timeTarget.channel}
          initialScheduledAt={timeTarget.scheduledAt}
          loading={scheduleMutation.isPending}
          onClose={closeTimeSheet}
          onConfirm={(selection) => scheduleMutation.mutate({ id: timeTarget.id, selection })}
        />
      ) : null}

      <SentSheet
        draft={sentTarget}
        visible={sentTarget !== null}
        loading={rescheduleMutation.isPending}
        onClose={() => setSentTarget(null)}
        onReschedule={(d) => guardOnline(() => rescheduleMutation.mutate(d))}
      />

      <Toast {...toastProps} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  search: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  tab: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabFailed: { backgroundColor: colors.lowSoft, borderColor: colors.lowBorder },
  tabSelected: { backgroundColor: colors.navy, borderColor: colors.navy },
  tabLabel: { fontFamily: fonts.medium, fontSize: fontSize.md, color: colors.textSecondary },
  tabLabelFailed: { color: colors.lowText },
  tabLabelSelected: { fontFamily: fonts.bold, color: colors.onDark },
  info: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
  },
  infoText: { fontFamily: fonts.regular, flex: 1, fontSize: fontSize.md, lineHeight: 21, color: colors.textSecondary },
  infoBold: { fontFamily: fonts.bold, color: colors.primaryDark },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
});
