// STEP: PHASE 3 · Page-step 9 · M17 Write my own
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { draftsApi } from '../api/drafts';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';
import Avatar from '../components/Avatar';
import Button from '../components/Button';
import CharacterCounter from '../components/CharacterCounter';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import OfflineBar from '../components/OfflineBar';
import { useIsOffline } from '../hooks/useIsOffline';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';
import { Channel } from '../types/draft';
import type { DraftsNavParams } from '../types/navigation';
import { writeOwnCache } from '../utils/draftEditsCache';
import { getErrorMessage } from '../utils/errors';
import { CHANNEL_LABEL, REASON_LABEL, whereFromLine } from '../utils/labels';
import * as Clipboard from 'expo-clipboard';
import SentCheckSheet from '../components/SentCheckSheet';
import Toast, { useToast } from '../components/Toast';
import { useExternalAppReturn } from '../hooks/useExternalAppReturn';
import { OpenFailureReason, OpenResult, messengerUsername, openEmail, openMessenger, openSms, openTelegram, openWhatsApp } from '../utils/messaging';
import ChannelSelector, { ChannelOption } from '../components/ChannelSelector';

type Props = NativeStackScreenProps<DraftsNavParams, 'WriteOwn'>;

// Idea chip colors from the design (pink, cyan, amber, indigo)
const IDEA_TINTS = [
  { bg: '#FDF2F8', border: '#FBCFE8', fg: '#831843' },
  { bg: '#ECFEFF', border: '#A5F3FC', fg: '#164E63' },
  { bg: '#FFFBEB', border: '#FDE68A', fg: '#78350F' },
  { bg: '#EEF2FF', border: '#C7D2FE', fg: '#312E81' },
] as const;

const MAX_LENGTH: Record<Channel, number> = { whatsapp: 4096, sms: 160, telegram: 4096, email: 10000, messenger: 10000 };

/** M17 Write my own: no AI. The text is kept even if the user leaves or goes offline. */
export default function WriteOwn({ route, navigation }: Props): React.JSX.Element {
  const { contactId, contactName } = route.params;
  const firstName = contactName.split(' ')[0];
  const isOffline = useIsOffline();
  const queryClient = useQueryClient();
  const [text, setText] = useState(() => writeOwnCache.get(contactId));

  const { data: options, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['messageOptions', contactId],
    queryFn: () => draftsApi.messageOptions(contactId),
  });

  // Starts on the contact's preferred channel, but the user can switch (same as the New message page)
  const [pickedChannel, setPickedChannel] = useState<Channel | null>(null);
  const channel: Channel =
    pickedChannel && options?.channels.includes(pickedChannel) ? pickedChannel : (options?.preferredChannel ?? 'whatsapp');

  const changeText = (next: string) => {
    setText(next);
    writeOwnCache.set(contactId, next);
  };

  const addIdea = (idea: string) => changeText(text.trim() ? `${text.trimEnd()} ${idea}` : idea);

  const createManual = useMutation({
    mutationFn: () => draftsApi.createManualDraft(contactId, { content: text.trim(), channel }),
  });

  const createAi = useMutation({
    mutationFn: () => draftsApi.createDraft(contactId, { reason: 'check_in' }),
    onSuccess: ({ id }) => navigation.replace('ReviewDraft', { draftId: id, mode: 'new' }),
  });

  // The draft is created on the first Send; a second Send (after "Not yet") updates the same draft
  const [draftId, setDraftId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentCheckOpen, setSentCheckOpen] = useState(false);
  const [markingSent, setMarkingSent] = useState(false);
  const { toastProps, showToast } = useToast();
  // Fires when the user comes back from WhatsApp / Messenger: ask, never assume
  const { arm, disarm } = useExternalAppReturn(() => setSentCheckOpen(true));

  /** Saves the text (new draft or update) and returns the draft id */
  const saveDraft = async (): Promise<string> => {
    if (draftId) {
      await draftsApi.update(draftId, { body: text.trim(), channel });
      return draftId;
    }
    const { id } = await createManual.mutateAsync();
    setDraftId(id);
    writeOwnCache.set(contactId, '');
    return id;
  };

  /** Opens the chosen app straight from this page (no detour through the New message page) */
  const openApp = async (id: string): Promise<void> => {
    const body = text.trim();
    // Phone, Telegram, email and Messenger username of the contact
    const draft = await draftsApi.get(id);
    arm();
    let result: OpenResult;
    if (channel === 'whatsapp') result = await openWhatsApp(draft.contactWhatsapp ?? draft.contactPhone, body);
    else if (channel === 'telegram') result = await openTelegram(draft.contactTelegram, body);
    else if (channel === 'email') result = await openEmail(draft.contactEmail, REASON_LABEL[draft.reason], body);
    else if (channel === 'messenger') {
      // Messenger cannot carry the text in the link: copy it so the user can paste it in the chat
      if (messengerUsername(draft.contactMessenger)) {
        try {
          await Clipboard.setStringAsync(body);
          showToast('Message copied. Paste it in the chat.');
        } catch {
          // the user can still copy it from Drafts
        }
      }
      result = await openMessenger(draft.contactMessenger);
    } else result = await openSms(draft.contactPhone, body);
    if (!result.ok) {
      disarm();
      showOpenFailure(result.reason);
    }
  };

  const showOpenFailure = (reason: OpenFailureReason) => {
    if (reason === 'whatsapp_unavailable') {
      showToast(
        options?.channels.includes('sms') ? "WhatsApp isn't installed. Pick SMS under Send via." : "WhatsApp isn't installed on this phone.",
        'error',
      );
    } else if (reason === 'no_phone') showToast('This contact has no phone number. Add one in Edit contact.', 'warning');
    else if (reason === 'no_email') showToast('This contact has no email address. Add one in Edit contact.', 'warning');
    else if (reason === 'no_messenger') showToast('Add a valid Messenger username in Edit contact.', 'warning');
    else showToast("Couldn't open the messaging app.", 'error');
  };

  const sendNow = async () => {
    setSending(true);
    try {
      const id = await saveDraft();
      await openApp(id);
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setSending(false);
    }
  };

  const schedule = async () => {
    try {
      const id = await saveDraft();
      navigation.replace('ReviewDraft', { draftId: id, mode: 'new', openSchedule: true });
    } catch {
      // The error text below is shown from createManual.error
    }
  };

  const handleSentYes = async () => {
    if (!draftId) return;
    setMarkingSent(true);
    try {
      const result = await draftsApi.markSent(draftId);
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      setSentCheckOpen(false);
      navigation.replace('Sent', result);
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setMarkingSent(false);
    }
  };

  // "Not yet": the message stays as a draft
  const handleSentNotYet = () => {
    setSentCheckOpen(false);
    showToast('Draft kept. You can send it any time from Drafts.', 'warning');
  };

  const handleOpenAgain = async () => {
    setSentCheckOpen(false);
    if (draftId) await openApp(draftId).catch((e) => showToast(getErrorMessage(e), 'error'));
  };

  const header = <AppHeader title={`Write to ${firstName}`} onBack={() => navigation.goBack()} />;

  if (isLoading) {
    return (
      <View style={styles.screen}>
        {header}
        <LoadingState message="Loading" />
      </View>
    );
  }
  if (isError || !options) {
    return (
      <View style={styles.screen}>
        {header}
        <ErrorState message={getErrorMessage(error, "Couldn't load this contact.")} onRetry={() => refetch()} />
      </View>
    );
  }

  // Disabled buttons say why
  let blockedReason: string | null = null;
  if (isOffline) blockedReason = "You're offline. Your message is saved. Reconnect to send.";
  else if (!text.trim()) blockedReason = 'Write something to send.';
  const sendDisabled = blockedReason !== null;
  const saving = createManual.isPending || sending;
  const channelOptions: ChannelOption[] = options.channels.map((value) => ({ value, label: CHANNEL_LABEL[value] }));

  return (
    <View style={styles.screen}>
      {header}
      <OfflineBar isOffline={isOffline} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.person}>
            <Avatar name={contactName} size={40} />
            <View style={styles.flex}>
              <Text style={styles.personName}>{contactName}</Text>
              <Text style={styles.personSub}>Your own words · no AI</Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Your message</Text>
          <TextInput
            value={text}
            onChangeText={changeText}
            multiline
            autoFocus
            textAlignVertical="top"
            placeholder={`Write to ${firstName}…`}
            placeholderTextColor={colors.textMuted}
            style={styles.editor}
            accessibilityLabel={`Message to ${contactName}`}
          />
          <CharacterCounter text={text} maxLength={MAX_LENGTH[channel]} />

          {options.ideas.length > 0 ? (
            <View style={styles.ideas}>
              <Text style={styles.ideasLabel}>Need an idea? From what you remember</Text>
              <View style={styles.chips}>
                {options.ideas.map((idea, i) => {
                  const tint = IDEA_TINTS[i % IDEA_TINTS.length];
                  return (
                    <Pressable
                      key={idea}
                      onPress={() => addIdea(idea)}
                      accessibilityRole="button"
                      style={[styles.chip, { backgroundColor: tint.bg, borderColor: tint.border }]}
                    >
                      <Text style={[styles.chipText, { color: tint.fg }]}>{idea}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={() => createAi.mutate()}
            disabled={isOffline || saving || createAi.isPending}
            accessibilityRole="button"
            style={[styles.aiLink, (isOffline || saving) && styles.disabled]}
          >
            {createAi.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="sparkles-outline" size={15} color={colors.primary} />
            )}
            <Text style={styles.aiLinkText}>Write it for me instead</Text>
          </Pressable>
          {isOffline ? <Text style={styles.hint}>AI drafts are unavailable while you're offline.</Text> : null}

          {options.channels.length > 1 ? (
            <>
              <Text style={[styles.fieldLabel, styles.sendViaLabel]}>Send via</Text>
              <ChannelSelector value={channel} onChange={setPickedChannel} options={channelOptions} />
            </>
          ) : null}

          {createManual.isError ? <Text style={styles.error}>{getErrorMessage(createManual.error)}</Text> : null}
          {createAi.isError ? <Text style={styles.error}>{getErrorMessage(createAi.error, "Couldn't write a draft.")}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <Text style={styles.fromLine}>{whereFromLine(channel)}</Text>
          <View style={styles.footerRow}>
            <View style={styles.flex}>
              <Button title="Schedule" onPress={schedule} disabled={sendDisabled || saving} variant="secondary" />
            </View>
            <View style={styles.flexWide}>
              <Button title={`Send via ${CHANNEL_LABEL[channel]}`} onPress={sendNow} loading={saving} disabled={sendDisabled} variant="primary" />
            </View>
          </View>
          {blockedReason ? <Text style={styles.blocked}>{blockedReason}</Text> : null}
        </View>
      </KeyboardAvoidingView>

      <SentCheckSheet
        visible={sentCheckOpen}
        channel={channel}
        contactName={contactName}
        loading={markingSent}
        onYes={handleSentYes}
        onNotYet={handleSentNotYet}
        onOpenAgain={handleOpenAgain}
        onClose={() => setSentCheckOpen(false)}
      />

      <Toast {...toastProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  flexWide: { flex: 1.6 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  editor: {
    fontFamily: fonts.regular,
    minHeight: 200,
    padding: 14,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16, // PRD: input text is always 16 so iPhone does not zoom
    lineHeight: 25,
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: 14 },
  personName: { fontFamily: fonts.bold, fontSize: fontSize.body, color: colors.text },
  personSub: { fontFamily: fonts.regular, fontSize: fontSize.small, color: colors.textMuted, marginTop: 2 },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: fontSize.small, color: colors.textSecondary, marginBottom: spacing.sm },
  sendViaLabel: { marginTop: spacing.lg },
  ideas: {
    marginTop: 14,
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  ideasLabel: { fontFamily: fonts.semibold, fontSize: fontSize.small, color: colors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: { fontFamily: fonts.medium, fontSize: fontSize.small },
  aiLink: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    marginTop: spacing.sm,
  },
  aiLinkText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  disabled: { opacity: 0.4 },
  hint: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center' },
  error: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.low, marginTop: spacing.md },
  footer: {
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  fromLine: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center' },
  footerRow: { flexDirection: 'row', gap: spacing.md },
  blocked: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center' },
});