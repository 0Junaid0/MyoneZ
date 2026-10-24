// STEP: Page-step 9 · M15 What's it about? (sheet)
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery } from '@tanstack/react-query';
import { contactsApi } from '../api/contactsApi';
import { draftsApi } from '../api/drafts';
import { useIsOffline } from '../hooks/useIsOffline';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';
import { CreateDraftInput } from '../types/draft';
import type { DraftsNavParams } from '../types/navigation';
import { getErrorMessage } from '../utils/errors';
import { REASON_NOUN } from '../utils/labels';
import { describeWhen } from '../utils/time';
import BottomSheet from './BottomSheet';
import Button from './Button';

export interface TopicSheetProps {
  visible: boolean;
  contactId: string;
  contactName: string;
  onClose: () => void;
  /** Set when opened from "Change" on a new message: the new draft replaces this screen */
  currentDraftId?: string;
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface RowProps {
  title: string;
  subtitle?: string;
  icon: IconName;
  iconColor: string;
  iconBg: string;
  disabled?: boolean;
  /** No chevron and not tappable as a whole (the "Something else" row) */
  static?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
}

function Row({ title, subtitle, icon, iconColor, iconBg, disabled, static: isStatic, onPress, children }: RowProps): React.JSX.Element {
  const content = (
    <View style={styles.rowMain}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {isStatic ? null : <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />}
    </View>
  );
  if (isStatic) {
    return (
      <View style={[styles.row, disabled && styles.rowDisabled]}>
        {content}
        {children}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.row, disabled && styles.rowDisabled, pressed && styles.rowPressed]}
    >
      {content}
    </Pressable>
  );
}

/** M15 "What's it about?". Member 2 only needs: <TopicSheet visible contactId contactName onClose /> */
export default function TopicSheet({ visible, contactId, contactName, onClose, currentDraftId }: TopicSheetProps): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<DraftsNavParams>>();
  const isOffline = useIsOffline();
  const [otherText, setOtherText] = useState('');
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const firstName = contactName.split(' ')[0];

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['messageOptions', contactId],
    queryFn: () => draftsApi.messageOptions(contactId),
    enabled: visible,
  });
  const memories = useQuery({
    queryKey: ['memories', contactId],
    queryFn: () => contactsApi.listMemories(contactId),
    enabled: visible,
  });

  useEffect(() => {
    if (!visible) {
      setChosen({});
      return;
    }
    if (!memories.data) return;
    // Every time the sheet opens, nothing is selected: the user picks the memories to include
    setChosen(Object.fromEntries(memories.data.map((item) => [item.id, false])));
  }, [visible, memories.data]);

  const create = useMutation({
    mutationFn: async (input: CreateDraftInput) => {
      const saved = memories.data ?? [];
      await Promise.all(
        saved
          .filter((item) => Boolean(chosen[item.id]) !== item.selected)
          .map((item) => contactsApi.setMemorySelected(contactId, item.id, Boolean(chosen[item.id]))),
      );
      return draftsApi.createDraft(contactId, input);
    },
    onSuccess: ({ id }) => {
      onClose();
      setOtherText('');
      const params = { draftId: id, mode: 'new' as const };
      if (currentDraftId) navigation.replace('ReviewDraft', params);
      else navigation.navigate('ReviewDraft', params);
    },
  });

  const pick = (input: CreateDraftInput) => {
    if (isOffline) return;
    create.mutate(input);
  };

  const writeOwn = () => {
    onClose();
    navigation.navigate('WriteOwn', { contactId, contactName });
  };

  const openExisting = (id: string) => {
    onClose();
    navigation.navigate('ReviewDraft', { draftId: id, mode: 'review' });
  };

  const existing = data?.openMessage && data.openMessage.id !== currentDraftId ? data.openMessage : undefined;
  const existingWhen =
    existing?.status === 'scheduled' && existing.scheduledAt ? describeWhen(existing.scheduledAt, existing.timezone ?? 'UTC') : null;

  const selectedMemories = (memories.data ?? []).filter((item) => chosen[item.id]);
  const generateFromMemories = () => {
    if (selectedMemories.length === 0) return;
    const note = selectedMemories.map((item) => item.text).join(', ');
    const lowered = note.toLowerCase();
    const reason = lowered.includes('birthday') ? 'birthday' : lowered.includes('anniver') ? 'congrats' : 'check_in';
    pick({ reason, note: `Mention ${note}.` });
  };

  const otherReady = otherText.trim().length > 0;
  const otherPlaceholder = data?.ideas[0] ? `e.g. ${data.ideas[0].charAt(0).toLowerCase()}${data.ideas[0].slice(1)}` : 'e.g. ask how the new job is going';

  const aiDisabled = isOffline || create.isPending;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header">Message {firstName}</Text>
          <Text style={styles.subtitle}>What's it about? We'll write a draft from what you know about {firstName}.</Text>
        </View>
        <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8}>
          <Ionicons name="close" size={20} color={colors.text} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : isError || !data ? (
        <View style={styles.center}>
          <Text style={styles.error}>{getErrorMessage(error, "Couldn't load options.")}</Text>
          <Button title="Try again" onPress={() => refetch()} variant="secondary" />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {existing ? (
            <View style={styles.banner}>
              <Ionicons name="time-outline" size={20} color={colors.fairText} />
              <Text style={styles.bannerText}>
                A {REASON_NOUN[existing.reason]} to {firstName} is already{' '}
                {existingWhen ? (
                  <>
                    scheduled for <Text style={styles.bannerBold}>{existingWhen}</Text>.
                  </>
                ) : (
                  'waiting for review.'
                )}
              </Text>
              <Pressable onPress={() => openExisting(existing.id)} accessibilityRole="button" hitSlop={8} style={styles.bannerAction}>
                <Text style={styles.bannerActionText}>Open it</Text>
              </Pressable>
            </View>
          ) : null}

          {memories.data && memories.data.length > 0 ? (
            <View style={styles.memoryBlock}>
              <Text style={styles.memoryLabel}>Memories to include</Text>
              <Text style={styles.memoryHint}>Select any, then generate the message. More than one can be selected.</Text>
              <View style={styles.chips}>
                {memories.data.map((item) => {
                  const on = Boolean(chosen[item.id]);
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setChosen((current) => ({ ...current, [item.id]: !current[item.id] }))}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{item.text}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Button
                title="Generate message"
                onPress={generateFromMemories}
                disabled={aiDisabled || selectedMemories.length === 0}
                loading={create.isPending && selectedMemories.length > 0}
              />
            </View>
          ) : null}

          <View style={styles.group}>
            <Row
              title="Check in"
              subtitle={`A light hello, built from what you know about ${firstName}`}
              icon="chatbox-outline"
              iconColor={colors.primary}
              iconBg={colors.primarySoft}
              disabled={aiDisabled}
              onPress={() => pick({ reason: 'check_in' })}
            />
            <Row
              title="Reconnect"
              subtitle="It has been a while, pick things up again"
              icon="people-outline"
              iconColor={colors.healthy}
              iconBg={colors.healthySoft}
              disabled={aiDisabled}
              onPress={() => pick({ reason: 'reconnect' })}
            />
            <Row
              title="Birthday"
              subtitle={`Wish ${firstName} a happy birthday`}
              icon="gift-outline"
              iconColor={colors.lowText}
              iconBg={colors.lowSoft}
              disabled={aiDisabled}
              onPress={() => pick({ reason: 'birthday' })}
            />
            <Row
              title="Congratulations"
              subtitle={data.latestEvent ? `On: ${data.latestEvent}` : 'Celebrate good news'}
              icon="sparkles-outline"
              iconColor={colors.pinkText}
              iconBg={colors.pinkSoft}
              disabled={aiDisabled}
              onPress={() => pick({ reason: 'congrats' })}
            />
            <Row
              title="Gratitude"
              subtitle={data.openFavor ? `For: ${data.openFavor}` : 'Say thanks for something they did'}
              icon="heart-outline"
              iconColor={colors.fairText}
              iconBg={colors.fairSoft}
              disabled={aiDisabled}
              onPress={() => pick({ reason: 'thanks' })}
            />
            <Row
              title="Something else"
              subtitle="Tell us in a few words"
              icon="pencil-outline"
              iconColor={colors.textSecondary}
              iconBg={colors.neutralSoft}
              disabled={isOffline}
              static
            >
              <View style={styles.otherRow}>
                <TextInput
                  value={otherText}
                  onChangeText={setOtherText}
                  placeholder={otherPlaceholder}
                  placeholderTextColor={colors.textFaint}
                  style={styles.input}
                  accessibilityLabel="What the message is about"
                  maxLength={140}
                  editable={!isOffline}
                  returnKeyType="send"
                  onSubmitEditing={() => otherReady && pick({ reason: 'other', note: otherText.trim() })}
                />
                <Pressable
                  onPress={() => pick({ reason: 'other', note: otherText.trim() })}
                  disabled={aiDisabled || !otherReady}
                  accessibilityRole="button"
                  accessibilityLabel="Write a draft"
                  style={[styles.go, (aiDisabled || !otherReady) && styles.goDisabled]}
                >
                  {create.isPending && otherReady ? (
                    <ActivityIndicator color={colors.onDark} />
                  ) : (
                    <Ionicons name="arrow-forward" size={22} color={colors.onDark} />
                  )}
                </Pressable>
              </View>
            </Row>
          </View>

          <Pressable onPress={writeOwn} accessibilityRole="button" style={({ pressed }) => [styles.own, pressed && styles.rowPressed]}>
            <Ionicons name="pencil-outline" size={18} color={colors.text} />
            <Text style={styles.ownText}>Write my own, no AI</Text>
          </Pressable>

          {isOffline ? <Text style={styles.hint}>You're offline. AI drafts are unavailable, but you can write your own.</Text> : null}
          {create.isPending ? <Text style={styles.hint}>Writing a draft…</Text> : null}
          {create.isError ? <Text style={styles.error}>{getErrorMessage(create.error, "Couldn't write a draft. Try again.")}</Text> : null}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg },
  headerText: { flex: 1 },
  title: { fontFamily: fonts.extrabold, fontSize: fontSize.xl, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textMuted, marginTop: 2, lineHeight: 21 },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutralSoft,
  },
  center: { paddingVertical: spacing.xxxl, alignItems: 'center', gap: spacing.md },
  // 5 topics + Something else + Write my own: scroll on small phones
  scroll: { maxHeight: Dimensions.get('window').height * 0.62 },
  list: { gap: spacing.md },
  memoryBlock: { gap: spacing.sm },
  memoryLabel: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: colors.text },
  memoryHint: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textSecondary },
  chipTextOn: { fontFamily: fonts.bold, color: colors.primaryDark },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: colors.fairSoft,
  },
  bannerText: { fontFamily: fonts.regular, flex: 1, fontSize: fontSize.md, lineHeight: 21, color: colors.fairText },
  bannerBold: { fontFamily: fonts.bold },
  bannerAction: { minHeight: 44, justifyContent: 'center' },
  bannerActionText: { fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.fairText },
  group: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    marginTop: -1, // hides the first row's top line inside the rounded group
  },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  rowIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowDisabled: { opacity: 0.45 },
  rowPressed: { backgroundColor: colors.divider },
  rowTitle: { fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.text },
  rowSub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  otherRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  input: {
    fontFamily: fonts.regular,
    flex: 1,
    height: 50,
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16, // PRD: input text is always 16 so iPhone does not zoom
  },
  go: {
    width: 50,
    height: 50,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  goDisabled: { backgroundColor: colors.inputBorder },
  own: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
  },
  ownText: { fontFamily: fonts.semibold, fontSize: fontSize.md, color: colors.text },
  hint: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  error: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.low },
});
