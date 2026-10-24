/**
 * ===============================================================
 *  FILE: pages/Home.tsx
 *  OWNER: Member 1  |  PHASE: 3 (Pages)
 *  WHAT: The Home tab (first tab after log in). Top to bottom:
 *    1. "Good morning, Ayesha" + today's date + bell (red dot if unread)
 *    2. "Turn on reminders" card — only if notifications are off
 *    3. Navy card: "3 drafts waiting" + network health ring + Review drafts
 *    4. Three count cards: Due today · Overdue · Later this week
 *    5. "Up next" list (UpcomingActionCard rows) + "See schedule"
 *    6. Floating draft button: pick a person, then write a draft for them
 *  STATES: loading skeleton · error with Try again · empty (no contacts)
 *          · pull down to refresh
 *  BACKEND: GET /api/home/  (one call gives everything on this page)
 *  NEEDS: Member 2 HealthRing, Member 4 QueryClientProvider in App.tsx
 * ===============================================================
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { ArrowRight, Bell, BellRing, ChevronRight, NotebookPen, Users } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { Button } from '../components/Button';
import { DashboardCard } from '../components/DashboardCard';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import QuickDraftSheet from '../components/QuickDraftSheet';
import { UpcomingActionCard } from '../components/UpcomingActionCard';
import { homeApi } from '../api/homeApi';
import { getErrorMessage } from '../api/client';
import { useAuthStore } from '../store/auth';
import { registerDeviceForPush } from '../notifications/push';
import { usePushPermission } from '../notifications/usePushPermission';
import type { UpNextItem } from '../types/api';
import type { AppStackParamList, MainTabParamList } from '../types/navigation';
import { colors, fonts, fontSize, healthLabel, radius, sizes, spacing } from '../theme/tokens';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<AppStackParamList>
>;

/** Other members can call queryClient.invalidateQueries({ queryKey: HOME_QUERY_KEY }) */
export const HOME_QUERY_KEY = ['home'] as const;

function greeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayText(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "2 are overdue — start with Maya and Tanvir." (design M05) */
function heroLine(overdue: number, upNext: UpNextItem[], health: number): string {
  if (overdue === 0) return `Nothing overdue. Network health: ${healthLabel(health)}.`;
  const names = upNext
    .filter((i) => i.status === 'overdue')
    .slice(0, 2)
    .map((i) => i.name.split(' ')[0]);
  const lead = overdue === 1 ? '1 is overdue' : `${overdue} are overdue`;
  return names.length ? `${lead} — start with ${names.join(' and ')}.` : `${lead}.`;
}

/** Network health ring on the navy card: light blue on a dark track, "health" under the number */
function HeroRing({ score }: { score: number }) {
  const safe = Math.min(100, Math.max(0, Math.round(score)));
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <View style={styles.ring} accessibilityRole="progressbar" accessibilityLabel={`Network health ${safe} percent`}>
      <Svg width={64} height={64} viewBox="0 0 64 64">
        <Circle cx={32} cy={32} r={r} fill="none" stroke={colors.navyLight} strokeWidth={7} />
        <Circle
          cx={32}
          cy={32}
          r={r}
          fill="none"
          stroke={colors.brandGlow}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={`${(c * safe) / 100} ${c}`}
          transform="rotate(-90 32 32)"
        />
      </Svg>
      <View style={styles.ringLabel}>
        <Text style={[styles.ringValue, safe === 100 && styles.ringValueSmall]}>{safe}%</Text>
        <Text style={styles.ringCaption}>health</Text>
      </View>
    </View>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const push = usePushPermission();
  const deviceSaved = useRef(false);
  const [quickDraftOpen, setQuickDraftOpen] = useState(false);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: HOME_QUERY_KEY,
    queryFn: homeApi.getSummary,
    // Due today / Overdue depend on the clock, so re-check while Home stays open
    refetchInterval: 30_000,
  });

  // Home stays mounted under the tabs: refresh the counts each time it comes back into view
  useRefreshOnFocus(refetch);

  // Send the push token to the backend once, when permission is on
  useEffect(() => {
    if (push.status !== 'granted' || deviceSaved.current) return;
    deviceSaved.current = true;
    registerDeviceForPush().catch(() => {
      deviceSaved.current = false; // try again next time
    });
  }, [push.status]);

  const openItem = (item: UpNextItem) => {
    if (item.draft_id) {
      navigation.navigate('ReviewDraft', { draftId: item.draft_id });
    } else {
      navigation.navigate('ContactDetails', { contactId: item.contact_id });
    }
  };

  const now = new Date();
  const hasUnread = (data?.unread_notifications ?? 0) > 0;

  /* ---------- Header (same in every state) ---------- */
  const header = (
    <View style={styles.header}>
      <View style={styles.flex}>
        <Text style={styles.date}>{todayText(now)}</Text>
        <Text style={styles.greeting} accessibilityRole="header" numberOfLines={1}>
          {greeting(now)}
          {user?.first_name ? `, ${user.first_name}` : ''}
        </Text>
      </View>
      <Pressable
        onPress={() => navigation.navigate('Notifications')}
        accessibilityRole="button"
        accessibilityLabel={hasUnread ? `Notifications, ${data?.unread_notifications} unread` : 'Notifications'}
        style={styles.bell}
      >
        <Bell size={20} color={colors.textSecondary} />
        {hasUnread ? <View style={styles.bellDot} /> : null}
      </Pressable>
    </View>
  );

  /* ---------- Loading / error ---------- */
  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.content}>
          {header}
          <LoadingState variant="skeleton" rows={3} message="Loading your day" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.content}>
          {header}
          <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
        </View>
      </SafeAreaView>
    );
  }

  const draftsText =
    data.drafts_waiting === 0
      ? 'No drafts waiting'
      : data.drafts_waiting === 1
        ? '1 draft is waiting'
        : `${data.drafts_waiting} drafts are waiting`;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={colors.primary}
          />
        }
      >
        {header}

        {/* ---------- 2. Permission reminder ---------- */}
        {push.status === 'denied' || push.status === 'undetermined' ? (
          <View style={styles.permissionCard}>
            <View style={styles.permissionIcon}>
              <BellRing size={20} color={colors.fairText} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.permissionTitle}>Turn on reminders</Text>
              <Text style={styles.permissionText}>
                Without notifications you'll miss drafts and birthdays.
              </Text>
            </View>
            <Button
              title="Turn on"
              variant="secondary"
              onPress={() => void push.request()}
              style={styles.permissionButton}
            />
          </View>
        ) : null}

        {data.total_contacts === 0 ? (
          /* ---------- Empty: brand-new account ---------- */
          <View style={styles.emptyCard}>
            <EmptyState
              icon={<Users size={28} color={colors.primary} />}
              title="Add your first contact"
              description="Add the people you want to stay in touch with. We'll remind you and write the first message."
              actionLabel="Add contact"
              onAction={() => navigation.navigate('AddContact')}
            />
          </View>
        ) : (
          <>
            {/* ---------- 3. Navy hero ---------- */}
            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={styles.flex}>
                  <Text style={styles.heroTitle}>{draftsText}</Text>
                  <Text style={styles.heroText}>{heroLine(data.overdue, data.up_next, data.network_health)}</Text>
                </View>
                <HeroRing score={data.network_health} />
              </View>
              {data.drafts_waiting > 0 ? (
                <Pressable
                  onPress={() => navigation.navigate('Drafts', { tab: 'review' })}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}
                >
                  <Text style={styles.heroButtonText}>Review drafts</Text>
                  <ArrowRight size={16} color={colors.navy} strokeWidth={2.4} />
                </Pressable>
              ) : null}
            </View>

            {/* ---------- 4. Count cards ---------- */}
            <View style={styles.stats}>
              <DashboardCard
                title="Due today"
                count={data.due_today}
                onPress={() => navigation.navigate('Schedule')}
              />
              <DashboardCard
                title="Overdue"
                count={data.overdue}
                tone={data.overdue > 0 ? 'danger' : 'default'}
                onPress={() => navigation.navigate('Schedule')}
              />
              <DashboardCard
                title="Later this week"
                count={data.later_this_week}
                onPress={() => navigation.navigate('Schedule')}
              />
            </View>

            {/* ---------- 5. Up next ---------- */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Up next</Text>
              <Pressable
                onPress={() => navigation.navigate('Schedule')}
                accessibilityRole="link"
                style={styles.seeAll}
              >
                <Text style={styles.seeAllText}>See schedule</Text>
                <ChevronRight size={16} color={colors.primary} />
              </Pressable>
            </View>

            {data.up_next.length === 0 ? (
              <View style={styles.emptyCard}>
                <EmptyState
                  title="All caught up"
                  description="Nobody needs a message right now. We'll let you know when someone does."
                />
              </View>
            ) : (
              <View style={styles.list}>
                {data.up_next.map((item, index) => (
                  <UpcomingActionCard
                    key={`${item.contact_id}-${item.due_date}`}
                    item={item}
                    onPress={openItem}
                    showDivider={index < data.up_next.length - 1}
                  />
                ))}
              </View>
            )}

          </>
        )}
      </ScrollView>

      {/* ---------- 6. Draft button: choose a person and write to them ---------- */}
      {data.total_contacts > 0 ? (
        <Pressable
          onPress={() => setQuickDraftOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Write a message"
          style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
        >
          <NotebookPen size={26} color={colors.onDark} strokeWidth={2} />
        </Pressable>
      ) : null}
      <QuickDraftSheet visible={quickDraftOpen} onClose={() => setQuickDraftOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl + 60, // room for the draft button
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  greeting: {
    marginTop: spacing.xxs,
    fontFamily: fonts.extrabold,
    fontSize: 24,
    letterSpacing: -0.5,
    color: colors.text,
  },
  date: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  bell: {
    width: sizes.minTap,
    height: sizes.minTap,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.low,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.fairSoft,
    borderRadius: radius.card,
    padding: spacing.md + 2,
  },
  permissionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.small + 1,
    color: colors.fairText,
  },
  permissionText: {
    marginTop: spacing.xxs,
    fontFamily: fonts.regular,
    fontSize: fontSize.caption,
    lineHeight: 17,
    color: colors.fairText,
  },
  permissionButton: {
    height: sizes.minTap,
    paddingHorizontal: spacing.md,
  },
  hero: {
    backgroundColor: colors.navy,
    borderRadius: radius.hero,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 21,
    letterSpacing: -0.4,
    color: colors.onDark,
  },
  heroText: {
    marginTop: 6,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onDarkMuted,
  },
  heroButton: {
    height: 48,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  heroButtonText: {
    fontFamily: fonts.bold,
    fontSize: fontSize.body,
    color: colors.navy,
  },
  pressed: {
    opacity: 0.85,
  },
  ring: {
    width: 64,
    height: 64,
  },
  ringLabel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    color: colors.onDark,
  },
  ringValueSmall: {
    fontSize: 13,
  },
  ringCaption: {
    fontFamily: fonts.regular,
    fontSize: 9,
    color: colors.onDarkMuted,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.section,
    color: colors.text,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    minHeight: sizes.minTap,
  },
  seeAllText: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.small,
    color: colors.primary,
  },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginTop: -spacing.sm,
  },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
