// pages/ContactDetails.tsx  (Owner: Member 2)
import { showAlert } from '../utils/alert';
import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp, ParamListBase, RouteProp } from '@react-navigation/native';

import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { contactsApi } from '../api/contactsApi';
import type { ContactDetailData } from '../api/contactsApi';
import { getErrorMessage } from '../api/client';
import Avatar from '../components/Avatar';
import HealthRing, { getHealthColor, getHealthLevel } from '../components/HealthRing';
import MemoryCard, { MEMORY_CATEGORIES } from '../components/MemoryCard';
import type { Memory, MemoryCategory } from '../components/MemoryCard';
import TimelineItem from '../components/TimelineItem';
import TopicSheet from '../components/TopicSheet'; // Member 3
import type { TimelineEntry } from '../components/TimelineItem';
import FilterChip from '../components/FilterChip';
import BottomSheet from '../components/BottomSheet';
import DatePicker from '../components/DatePicker';
import TimePicker from '../components/TimePicker';
import FrequencySelector, { DEFAULT_FREQUENCY, validateFrequency } from '../components/FrequencySelector';
import type { FrequencyValue } from '../components/FrequencySelector';
// Member 1's components. Check props if they differ.
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';

export type ContactDetail = ContactDetailData;

type DetailsRoute = RouteProp<{ ContactDetails: { id?: string; contactId?: string } }, 'ContactDetails'>;
type Tab = 'memories' | 'history' | 'info';

const HEALTH_TEXT = { good: 'Good · thriving', fair: 'Fair · cooling', poor: 'Needs attention' } as const;

const MEMORY_CATEGORY_KEYS = Object.keys(MEMORY_CATEGORIES) as MemoryCategory[];

export default function ContactDetails(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { params } = useRoute<DetailsRoute>();
  // Member 3 code navigates with `contactId`, ours with `id`. Accept both.
  const contactId = params.id ?? params.contactId ?? '';

  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('memories');

  const [topicOpen, setTopicOpen] = useState<boolean>(false);
  const [memoryOpen, setMemoryOpen] = useState<boolean>(false);
  const [memoryText, setMemoryText] = useState<string>('');
  const [memoryCategory, setMemoryCategory] = useState<MemoryCategory>('values');

  // "Schedule next check-in" (Save time) and "Outreach rhythm" (Save rhythm)
  const [timeOpen, setTimeOpen] = useState<boolean>(false);
  const [checkInDate, setCheckInDate] = useState<Date>(new Date());
  const [checkInTime, setCheckInTime] = useState<Date>(() => new Date(2000, 0, 1, 9, 0));
  const [rhythmOpen, setRhythmOpen] = useState<boolean>(false);
  const [rhythm, setRhythm] = useState<FrequencyValue>(DEFAULT_FREQUENCY);
  const [rhythmError, setRhythmError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState<boolean>(false);

  // silent: refresh in the background without the full-screen spinner
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      setContact(await contactsApi.getDetail(contactId));
    } catch {
      if (!silent) setError('Could not load this contact.');
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Coming back from Edit, a draft or Sent: show the new name, health and history
  useRefreshOnFocus(() => load(true));

  const logTalk = async (): Promise<void> => {
    try {
      await contactsApi.logTalk(contactId);
      await load(true);
      setTab('history');
    } catch (e) {
      showAlert('Could not log it', getErrorMessage(e));
    }
  };

  const saveMemory = async (): Promise<void> => {
    const text = memoryText.trim();
    if (!text) return;
    try {
      await contactsApi.addMemory(contactId, text, memoryCategory);
      setMemoryText('');
      setMemoryOpen(false);
      await load(true);
      setTab('memories');
    } catch (e) {
      showAlert('Could not save', getErrorMessage(e));
    }
  };

  const openTimeSheet = async (): Promise<void> => {
    try {
      const point = await contactsApi.getNextTouchpoint(contactId);
      const base = point ? new Date(point.due_at) : new Date();
      setCheckInDate(new Date(base.getFullYear(), base.getMonth(), base.getDate()));
      setCheckInTime(new Date(2000, 0, 1, base.getHours(), base.getMinutes()));
      setTimeOpen(true);
    } catch (e) {
      showAlert('Could not load it', getErrorMessage(e));
    }
  };

  const saveTime = async (): Promise<void> => {
    const when = new Date(
      checkInDate.getFullYear(),
      checkInDate.getMonth(),
      checkInDate.getDate(),
      checkInTime.getHours(),
      checkInTime.getMinutes(),
    );
    setSaving(true);
    try {
      await contactsApi.rescheduleNextCheckIn(contactId, when);
      setTimeOpen(false);
      await load(true);
    } catch (e) {
      showAlert('Could not save', getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const openRhythmSheet = async (): Promise<void> => {
    try {
      setRhythm(await contactsApi.getFrequency(contactId));
      setRhythmError(undefined);
      setRhythmOpen(true);
    } catch (e) {
      showAlert('Could not load it', getErrorMessage(e));
    }
  };

  const saveRhythm = async (): Promise<void> => {
    const err = validateFrequency(rhythm);
    if (err) {
      setRhythmError(err);
      return;
    }
    setSaving(true);
    try {
      await contactsApi.saveRhythm(contactId, rhythm);
      setRhythmOpen(false);
      await load(true);
    } catch (e) {
      showAlert('Could not save', getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const renderBody = (c: ContactDetail): React.JSX.Element => {
    if (tab === 'memories') {
      if (c.memories.length === 0) {
        return <EmptyState title="No memories yet" message="Add something worth remembering." />;
      }
      return (
        <View style={styles.card}>
          {c.memories.map((m, i) => (
            <View key={m.id}>
              {i > 0 && <View style={styles.divider} />}
              <MemoryCard memory={m} />
            </View>
          ))}
        </View>
      );
    }
    if (tab === 'history') {
      if (c.history.length === 0) {
        return <EmptyState title="No history yet" message="Logged talks and messages show up here." />;
      }
      return (
        <View style={styles.card}>
          {c.history.map((h, i) => (
            <TimelineItem key={h.id} entry={h} isLast={i === c.history.length - 1} />
          ))}
        </View>
      );
    }
    const rows: { label: string; value?: string }[] = [
      { label: 'Phone', value: c.phone },
      { label: 'WhatsApp', value: c.whatsapp },
      { label: 'Telegram', value: c.telegram },
      { label: 'Messenger', value: c.messenger },
      { label: 'Email', value: c.email },
      { label: 'Birthday', value: c.birthday },
      { label: 'Timezone', value: c.timezone },
    ];
    return (
      <View style={styles.card}>
        {rows
          .filter((r) => Boolean(r.value))
          .map((r, i) => (
            <View key={r.label}>
              {i > 0 && <View style={styles.divider} />}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{r.label}</Text>
                <Text style={styles.infoValue}>{r.value}</Text>
              </View>
            </View>
          ))}
      </View>
    );
  };

  const renderContent = (): React.JSX.Element => {
    if (loading) return <LoadingState />;
    if (error || !contact) return <ErrorState message={error ?? 'Not found'} onRetry={() => load()} />;

    const level = getHealthLevel(contact.healthScore);

    return (
      <>
        <View style={styles.profile}>
          <Avatar name={contact.name} size={88} imageUri={contact.imageUri} />
          <Text style={styles.name}>{contact.name}</Text>
          <View style={styles.pills}>
            <View style={[styles.pill, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.pillText, { color: '#3730A3' }]}>{contact.relationship}</Text>
            </View>
            {(contact.tags ?? []).map((t) => (
              <View key={t} style={[styles.pill, { backgroundColor: '#E2E8F0' }]}>
                <Text style={[styles.pillText, { color: '#475569' }]}>{t}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.card, styles.healthCard]}>
          <HealthRing score={contact.healthScore} size={64} strokeWidth={6} suffix="%" />
          <View style={styles.healthInfo}>
            <Text style={[styles.healthTitle, { color: getHealthColor(contact.healthScore) }]}>
              {HEALTH_TEXT[level]}
            </Text>
            <Text style={styles.healthSub}>Next check-in {contact.nextCheckIn}</Text>
            <Text style={styles.healthSub}>
              Every {contact.intervalDays}{contact.jitterDays > 0 ? ` ± ${contact.jitterDays}` : ''} days · {contact.channel}
            </Text>
            <View style={styles.healthLinks}>
              <Pressable onPress={openTimeSheet} hitSlop={8} accessibilityRole="button">
                <Text style={styles.healthLink}>Change time</Text>
              </Pressable>
              <Pressable onPress={openRhythmSheet} hitSlop={8} accessibilityRole="button">
                <Text style={styles.healthLink}>Change rhythm</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={[styles.action, styles.actionPrimary]}
            onPress={() => setTopicOpen(true)}
            accessibilityRole="button"
          >
            <Ionicons name="sparkles-outline" size={22} color={colors.primaryText} />
            <Text style={[styles.actionText, { color: colors.primaryText }]}>Message</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={logTalk} accessibilityRole="button">
            <Ionicons name="checkmark" size={22} color={colors.primary} />
            <Text style={styles.actionText}>Log a talk</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={() => setMemoryOpen(true)} accessibilityRole="button">
            <Ionicons name="add" size={22} color={colors.primary} />
            <Text style={styles.actionText}>Add memory</Text>
          </Pressable>
        </View>

        <View style={styles.tabs}>
          {(
            [
              ['memories', 'Memories'],
              ['history', 'History'],
              ['info', 'Contact info'],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <Pressable
              key={key}
              style={[styles.tab, tab === key && styles.tabActive]}
              onPress={() => setTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }}
            >
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {renderBody(contact)}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable style={styles.topBtn} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={styles.topText}>Contacts</Text>
        </Pressable>
        {contact && (
          <Pressable
            onPress={() => navigation.navigate('EditContact', { id: contact.id })}
            accessibilityRole="button"
          >
            <Text style={styles.topText}>Edit</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {renderContent()}
      </ScrollView>

      {contact ? (
        <TopicSheet
          visible={topicOpen}
          contactId={contact.id}
          contactName={contact.name}
          onClose={() => setTopicOpen(false)}
        />
      ) : null}

      <BottomSheet visible={timeOpen} onClose={() => setTimeOpen(false)} title="Next check-in">
        <DatePicker label="Date" value={checkInDate} onChange={(d) => d && setCheckInDate(d)} minimumDate={new Date()} clearable={false} />
        <View style={styles.sheetGap} />
        <TimePicker label="Time" value={checkInTime} onChange={(t) => t && setCheckInTime(t)} />
        <Pressable
          style={[styles.saveBtn, styles.sheetGap, saving && styles.saveBtnDisabled]}
          onPress={saveTime}
          disabled={saving}
          accessibilityRole="button"
        >
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save time'}</Text>
        </Pressable>
      </BottomSheet>

      <BottomSheet visible={rhythmOpen} onClose={() => setRhythmOpen(false)} title="Check-in rhythm">
        <FrequencySelector value={rhythm} onChange={setRhythm} error={rhythmError} />
        <Pressable
          style={[styles.saveBtn, styles.sheetGap, saving && styles.saveBtnDisabled]}
          onPress={saveRhythm}
          disabled={saving}
          accessibilityRole="button"
        >
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save rhythm'}</Text>
        </Pressable>
      </BottomSheet>

      <Modal visible={memoryOpen} transparent animationType="slide" onRequestClose={() => setMemoryOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.backdrop} onPress={() => setMemoryOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Add memory</Text>
            <View style={styles.sheetChips}>
              {MEMORY_CATEGORY_KEYS.map((k) => (
                <FilterChip
                  key={k}
                  label={MEMORY_CATEGORIES[k].title}
                  selected={memoryCategory === k}
                  onPress={() => setMemoryCategory(k)}
                />
              ))}
            </View>
            <TextInput
              style={styles.sheetInput}
              value={memoryText}
              onChangeText={setMemoryText}
              placeholder="Something to remember…"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <Pressable
              style={[styles.saveBtn, !memoryText.trim() && styles.saveBtnDisabled]}
              onPress={saveMemory}
              disabled={!memoryText.trim()}
              accessibilityRole="button"
            >
              <Text style={styles.saveText}>Save memory</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  topBtn: { flexDirection: 'row', alignItems: 'center' },
  topText: { fontFamily: fonts.medium, fontSize: fontSize.lg, color: colors.primary },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },

  profile: { alignItems: 'center', gap: spacing.sm },
  name: { fontFamily: fonts.bold, fontSize: fontSize.title, color: colors.text },
  pills: { flexDirection: 'row', gap: spacing.sm },
  pill: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  pillText: { fontFamily: fonts.medium, fontSize: fontSize.sm },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  divider: { height: 1, backgroundColor: colors.border },

  healthCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.lg },
  healthInfo: { flex: 1, gap: 2 },
  healthTitle: { fontFamily: fonts.bold, fontSize: fontSize.lg },
  healthSub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  healthLinks: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs },
  healthLink: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: colors.primary },
  sheetGap: { marginTop: spacing.md },

  actions: { flexDirection: 'row', gap: spacing.md },
  action: {
    flex: 1,
    height: 76,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionText: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: colors.text },

  tabs: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: radius.input,
    padding: 4,
  },
  tab: { flex: 1, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.surface },
  tabText: { fontFamily: fonts.medium, fontSize: fontSize.md, color: colors.textMuted },
  tabTextActive: { fontFamily: fonts.semibold, color: colors.text },

  infoRow: { paddingVertical: spacing.md, gap: 2 },
  infoLabel: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted },
  infoValue: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.text },

  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sheetTitle: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.text },
  sheetChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sheetInput: {
    fontFamily: fonts.regular,
    minHeight: 90,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    textAlignVertical: 'top',
  },
  saveBtn: {
    height: 48,
    borderRadius: radius.input,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveText: { fontFamily: fonts.semibold, color: colors.primaryText, fontSize: fontSize.md },
});
