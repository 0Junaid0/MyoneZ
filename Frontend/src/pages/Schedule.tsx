// pages/Schedule.tsx  (Owner: Member 4)
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';

import { fetchSchedule } from '../api/scheduleApi';
import AppHeader from '../components/AppHeader';
import CalendarStrip, { MONTHS, WEEKDAYS, addDays, dateKey, isSameDay, startOfDay } from '../components/CalendarStrip';
import type { CalendarMarker } from '../components/CalendarStrip';
import ScheduleItem from '../components/ScheduleItem';
// Member 1's components. Check props if they differ.
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { scheduleFutureLocalNotification } from '../notifications/push';
import EmptyState from '../components/EmptyState';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';


/** 'later' = everything scheduled after the next 30 days (no upper limit) */
type Range = 7 | 14 | 30 | 'later';
type Kind = 'Check-in' | 'Follow-up' | 'Birthday' | 'Thank-you';
type Channel = 'Telegram' | 'WhatsApp' | 'SMS' | 'Gmail' | 'Messenger';

export type ScheduleAction = {
  id: string;
  contactId: string;
  contactName: string;
  avatarUrl?: string | null;
  kind: Kind;
  channel: Channel;
  date: Date;
  /** Display time, e.g. "9:00 AM". Only for items due on a specific time. */
  time?: string;
  /** 0-23, used only for sorting items on the same day. */
  hour?: number;
  status: 'overdue' | 'ready' | 'scheduled';
  /** Draft to open for ready items. */
  draftId?: string;
};

const RANGES: Range[] = [7, 14, 30, 'later'];
const RANGE_LABEL = (r: Range): string => (r === 'later' ? '30+ days' : `${r} days`);
const LATER_TITLE: Record<Exclude<Range, 'later'>, string> = {
  7: 'Later this week',
  14: 'Later in the next 2 weeks',
  30: 'Later this month',
};
/** Day count the calendar strip covers (the 30+ view has no strip) */
const stripDays = (r: Range): number => (r === 'later' ? 0 : r);

function fullDate(d: Date): string {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function shortDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function subtitleOf(a: ScheduleAction): string {
  return `${a.kind} · ${a.channel}`;
}

function byDateThenHour(a: ScheduleAction, b: ScheduleAction): number {
  return a.date.getTime() - b.date.getTime() || (a.hour ?? 0) - (b.hour ?? 0);
}

export default function Schedule(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const today = useMemo(() => startOfDay(new Date()), []);

  const [actions, setActions] = useState<ScheduleAction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>(7);
  const [selected, setSelected] = useState<Date>(today);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const list = await fetchSchedule();
      setActions(list);

      // Register local notifications for future scheduled items on this device.
      for (const item of list) {
        if (item.status === 'scheduled' && item.date.getTime() > Date.now()) {
          void scheduleFutureLocalNotification({
            id: item.draftId ? `draft-${item.draftId}` : `schedule-${item.id}`,
            title: `${item.kind} with ${item.contactName}`,
            body: `Your ${item.channel} ${item.kind.toLowerCase()} is ready.`,
            triggerDate: item.date,
            push: item.draftId
              ? {
                  type: 'reminder',
                  draft_id: item.draftId,
                  contact_id: item.contactId,
                }
              : { type: 'check_in', contact_id: item.contactId },
          }).catch((notificationError: unknown) => {
            console.warn('[schedule] Could not register local notification:', notificationError);
          });
        }
      }
    } catch {
      setError('Could not load your schedule.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Tabs stay mounted: reload every time the screen comes back into view, so new schedules appear
  const firstLoad = useRef(true);
  useFocusEffect(
    useCallback(() => {
      void load(!firstLoad.current);
      firstLoad.current = false;
    }, [load]),
  );

  // Statuses depend on the clock: re-check while the tab stays open so a time that just passed moves to Overdue
  useEffect(() => {
    const id = setInterval(() => void load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const days = useMemo(() => Array.from({ length: stripDays(range) }, (_, i) => addDays(today, i)), [today, range]);

  // 30+ days: every scheduled item after the next 30 days, oldest first, no upper limit
  const beyond = useMemo(() => {
    const from = addDays(today, 30);
    return actions.filter((a) => a.status !== 'overdue' && a.date >= from).sort(byDateThenHour);
  }, [actions, today]);

  const { overdue, selectedItems, later, markers } = useMemo(() => {
    const end = addDays(today, stripDays(range) - 1);
    const overdueList = actions.filter((a) => a.status === 'overdue').sort(byDateThenHour);
    const upcoming = actions
      .filter((a) => a.status !== 'overdue' && a.date >= today && a.date <= end)
      .sort(byDateThenHour);

    const marks: Record<string, CalendarMarker> = {};
    upcoming.forEach((a) => {
      marks[dateKey(a.date)] = 'due';
    });
    if (overdueList.length > 0) marks[dateKey(today)] = 'overdue';

    return {
      overdue: overdueList,
      selectedItems: upcoming.filter((a) => isSameDay(a.date, selected)),
      later: upcoming.filter((a) => a.date > selected),
      markers: marks,
    };
  }, [actions, range, selected, today]);

  // Selected day may fall outside a shorter range after switching: snap back to today.
  const changeRange = (r: Range): void => {
    setRange(r);
    if (r !== 'later' && selected > addDays(today, r - 1)) setSelected(today);
  };

  const openAction = (a: ScheduleAction): void => {
    // A message exists (scheduled, ready or overdue): open it. Only a bare check-in date opens the profile.
    if (a.draftId) navigation.navigate('ReviewDraft', { draftId: a.draftId, mode: 'review' });
    else navigation.navigate('ContactDetails', { id: a.contactId });
  };

  const selectedTitle = `${isSameDay(selected, today) ? 'Today · ' : ''}${WEEKDAYS[selected.getDay()]} ${selected.getDate()} ${
    MONTHS[selected.getMonth()]
  }`;

  const renderBody = (): React.JSX.Element => {
    if (loading) return <LoadingState />;
    if (error) return <ErrorState message={error} onRetry={() => void load()} />;
    if (actions.length === 0) {
      return <EmptyState title="Nothing scheduled" message="Check-ins will show up here as they come due." />;
    }

    if (range === 'later') {
      return (
        <View style={styles.group}>
          <Text style={styles.sectionLabel}>After the next 30 days</Text>
          <View style={styles.card}>
            {beyond.length === 0 ? (
              <Text style={styles.empty}>Nothing scheduled beyond 30 days.</Text>
            ) : (
              beyond.map((a, i) => (
                <View key={a.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <ScheduleItem
                    name={a.contactName}
                    subtitle={`${subtitleOf(a)} · ${fullDate(a.date)}${a.time ? ` · ${a.time}` : ''}`}
                    imageUri={a.avatarUrl}
                    leading={{ type: 'avatar' }}
                    trailing={{ type: 'chevron' }}
                    onPress={() => openAction(a)}
                  />
                </View>
              ))
            )}
          </View>
        </View>
      );
    }

    return (
      <>
        {overdue.length > 0 && (
          <View style={styles.group}>
            <Text style={[styles.sectionLabel, styles.overdueLabel]}>Overdue</Text>
            <View style={[styles.card, styles.overdueCard]}>
              {overdue.map((a, i) => (
                <View key={a.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <ScheduleItem
                    name={a.contactName}
                    subtitle={subtitleOf(a)}
                    imageUri={a.avatarUrl}
                    leading={{ type: 'avatar' }}
                    trailing={{ type: 'text', text: `since ${isSameDay(a.date, today) && a.time ? a.time : shortDate(a.date)}`, danger: true }}
                    onPress={() => openAction(a)}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.group}>
          <Text style={styles.sectionLabel}>{selectedTitle}</Text>
          <View style={styles.card}>
            {selectedItems.length === 0 ? (
              <Text style={styles.empty}>Nothing scheduled for this day.</Text>
            ) : (
              selectedItems.map((a, i) => (
                <View key={a.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <ScheduleItem
                    name={a.contactName}
                    subtitle={subtitleOf(a)}
                    imageUri={a.avatarUrl}
                    leading={{ type: 'text', text: a.time ?? '—' }}
                    trailing={
                      a.status === 'ready'
                        ? { type: 'badge', label: 'Ready', tone: a.kind === 'Birthday' ? 'pink' : 'blue' }
                        : { type: 'badge', label: 'Scheduled', tone: 'gray' }
                    }
                    onPress={() => openAction(a)}
                  />
                </View>
              ))
            )}
          </View>
        </View>

        {later.length > 0 && (
          <View style={styles.group}>
            <Text style={styles.sectionLabel}>{LATER_TITLE[range as Exclude<Range, 'later'>]}</Text>
            <View style={styles.card}>
              {later.map((a, i) => (
                <View key={a.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <ScheduleItem
                    name={a.contactName}
                    subtitle={subtitleOf(a)}
                    imageUri={a.avatarUrl}
                    leading={{ type: 'text', text: `${WEEKDAYS[a.date.getDay()]} ${a.date.getDate()}` }}
                    trailing={{ type: 'chevron' }}
                    onPress={() => openAction(a)}
                  />
                </View>
              ))}
            </View>
          </View>
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppHeader title="Schedule" flush />

        <View style={styles.segment}>
          {RANGES.map((r) => (
            <Pressable
              key={r}
              style={[styles.segBtn, range === r && styles.segBtnActive]}
              onPress={() => changeRange(r)}
              accessibilityRole="button"
              accessibilityState={{ selected: range === r }}
            >
              <Text style={[styles.segText, range === r && styles.segTextActive]}>{RANGE_LABEL(r)}</Text>
            </Pressable>
          ))}
        </View>

        {range !== 'later' && (
          <CalendarStrip days={days} selected={selected} today={today} markers={markers} onSelect={setSelected} />
        )}

        {renderBody()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  segment: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: radius.input, padding: 4 },
  segBtn: { flex: 1, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  segBtnActive: { backgroundColor: colors.surface },
  segText: { fontFamily: fonts.medium, fontSize: fontSize.md, color: colors.textMuted },
  segTextActive: { fontFamily: fonts.semibold, color: colors.text },

  group: { gap: spacing.sm },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: fontSize.sm,
    letterSpacing: 1,
    color: '#475569',
    textTransform: 'uppercase',
  },
  overdueLabel: { color: '#B91C1C' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  overdueCard: { borderColor: '#FECACA' },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
  empty: { fontFamily: fonts.regular, padding: spacing.lg, fontSize: fontSize.md, color: colors.textMuted },
});
