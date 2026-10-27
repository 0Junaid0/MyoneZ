// STEP: PHASE 3 · Page-step 4 · M08 Review draft / M16 New message
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { draftsApi } from '../api/drafts';
import AppHeader from '../components/AppHeader';
import Avatar from '../components/Avatar';
import Button from '../components/Button';
import ChannelSelector, { ChannelOption } from '../components/ChannelSelector';
import CharacterCounter from '../components/CharacterCounter';
import ConfirmDialog from '../components/ConfirmDialog';
import ErrorState from '../components/ErrorState';
import HealthRing from '../components/HealthRing';
import LoadingState from '../components/LoadingState';
import OfflineBar from '../components/OfflineBar';
import ScheduleSheet from '../components/ScheduleSheet';
import BottomSheet from '../components/BottomSheet';
import SentCheckSheet from '../components/SentCheckSheet';
import Toast, { useToast } from '../components/Toast';
import LengthSelector from '../components/LengthSelector';
import ToneSelector, { DRAFT_TONE_OPTIONS } from '../components/ToneSelector';
import TopicSheet from '../components/TopicSheet';
import UseAnotherMedium from '../components/UseAnotherMedium';
import { useExternalAppReturn } from '../hooks/useExternalAppReturn';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { useIsOffline } from '../hooks/useIsOffline';
import { scheduleFutureLocalNotification } from '../notifications/push';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';
import { Channel, DraftLength, ScheduleSelection, Tone } from '../types/draft';
import type { DraftsNavParams } from '../types/navigation';
import { draftEditsCache } from '../utils/draftEditsCache';
import { getErrorMessage } from '../utils/errors';
import { healthWord } from '../utils/health';
import { CHANNEL_LABEL, REASON_LABEL, whereFromLine } from '../utils/labels';
import * as Clipboard from 'expo-clipboard';
import { OpenFailureReason, OpenResult, messengerUsername, openEmail, openMessenger, openSms, openTelegram, openWhatsApp } from '../utils/messaging';
import { describeWhen } from '../utils/time';

type Props = NativeStackScreenProps<DraftsNavParams, 'ReviewDraft'>;

/** Soft limits: only a visual warning, never blocks sending. */
const MAX_LENGTH: Record<Channel, number> = { whatsapp: 4096, sms: 160, telegram: 4096, email: 10000, messenger: 10000 };

/** M08 Review draft and M16 New message: one screen, same layout in both modes */
export default function ReviewDraft({ route, navigation }: Props): React.JSX.Element {
  const { draftId, mode = 'review', startSend = false, openSchedule = false } = route.params;
  const queryClient = useQueryClient();
  const isOffline = useIsOffline();
  const { toastProps, showToast } = useToast();

  const { data: draft, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['draft', draftId],
    queryFn: () => draftsApi.get(draftId),
    // The AI draft is written by a background job: poll until it is ready
    refetchInterval: (query) => (query.state.data?.generation === 'pending' ? 1500 : false),
  });

  // Coming back from the contact's Edit page: reload, so newly added mediums show up in "Send via"
  useRefreshOnFocus(() => refetch());

  const [body, setBody] = useState('');
  const [tone, setTone] = useState<Tone>('warm');
  // Used by Regenerate: length and the free-text direction for the AI writer
  const [length, setLength] = useState<DraftLength>('medium');
  const [instruction, setInstruction] = useState('');
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [ready, setReady] = useState(false);

  const [busy, setBusy] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [sentCheckOpen, setSentCheckOpen] = useState(false);
  const [topicOpen, setTopicOpen] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmSmsFallback, setConfirmSmsFallback] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Fill the editor once per draft (after the AI text is ready), so a refetch never wipes edits.
  // Unsaved edits from an earlier visit win over the server copy.
  const initialisedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!draft || draft.generation !== 'ready' || initialisedFor.current === draft.id) return;
    initialisedFor.current = draft.id;
    const pending = draftEditsCache.get(draft.id);
    setBody(pending?.body ?? draft.body);
    setTone(pending?.tone ?? draft.tone);
    setChannel(pending?.channel ?? draft.channel);
    setLength(draft.length);
    setInstruction(draft.source === 'ai' ? (draft.reasonNote ?? '') : '');
    setReady(true);
  }, [draft]);

  // Autosave edits. Offline: edits stay in the cache and are saved when the connection returns.
  useEffect(() => {
    if (!ready) return undefined;
    draftEditsCache.set(draftId, { body, tone, channel });
    const server = queryClient.getQueryData<{ body: string; tone: Tone; channel: Channel }>(['draft', draftId]);
    if (server && server.body === body && server.tone === tone && server.channel === channel) {
      draftEditsCache.clear(draftId);
      return undefined;
    }
    if (isOffline) return undefined;
    const timer = setTimeout(() => {
      draftsApi
        .update(draftId, { body, tone, channel })
        .then((saved) => {
          queryClient.setQueryData(['draft', draftId], saved);
          draftEditsCache.clear(draftId);
        })
        .catch(() => {
          // Stays in the cache; the next change or reconnect retries
        });
    }, 800);
    return () => clearTimeout(timer);
  }, [body, tone, channel, isOffline, ready, draftId, queryClient]);

  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    },
    [],
  );
  const leaveSoon = useCallback(() => {
    leaveTimer.current = setTimeout(() => navigation.goBack(), 900);
  }, [navigation]);

  const refreshLists = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['drafts'] });
    queryClient.invalidateQueries({ queryKey: ['draft', draftId] });
  }, [queryClient, draftId]);

  // Fires when the user returns from WhatsApp / SMS: ask, never assume
  const { arm, disarm } = useExternalAppReturn(() => setSentCheckOpen(true));

  const saveEdits = async () => {
    const saved = await draftsApi.update(draftId, { body, tone, channel });
    queryClient.setQueryData(['draft', draftId], saved);
    draftEditsCache.clear(draftId);
  };

  const openChannel = async (target: Channel): Promise<OpenResult> => {
    if (!draft) return { ok: false, reason: 'open_failed' };
    arm();
    let result: OpenResult;
    if (target === 'whatsapp') result = await openWhatsApp(draft.contactWhatsapp ?? draft.contactPhone, body);
    else if (target === 'telegram') result = await openTelegram(draft.contactTelegram, body);
    else if (target === 'email') result = await openEmail(draft.contactEmail, emailSubject, body);
    else if (target === 'messenger') {
      // Messenger cannot carry the text in the link: copy it so the user can paste it in the chat
      if (messengerUsername(draft.contactMessenger)) {
        try {
          await Clipboard.setStringAsync(body);
          showToast('Message copied. Paste it in the chat.');
        } catch {
          // the Copy button in the preview still works
        }
      }
      result = await openMessenger(draft.contactMessenger);
    } else result = await openSms(draft.contactPhone, body);
    if (!result.ok) disarm();
    return result;
  };

  const handleOpenFailure = (reason: OpenFailureReason) => {
    if (reason === 'whatsapp_unavailable') {
      if (draft?.contactChannels.includes('sms')) setConfirmSmsFallback(true);
      else showToast("WhatsApp isn't installed on this phone.", 'error');
      return;
    }
    if (reason === 'no_phone') {
      showToast('This contact has no phone number. Add one in Edit contact.', 'warning');
      return;
    }
    if (reason === 'no_email') {
      showToast('This contact has no email address. Add one in Edit contact.', 'warning');
      return;
    }
    if (reason === 'no_messenger') {
      showToast('Add a valid Messenger username in Edit contact.', 'warning');
      return;
    }
    showToast("Couldn't open the messaging app.", 'error');
  };

  const handleSend = async () => {
    if (isOffline) {
      showToast("You're offline. Reconnect to send.", 'error');
      return;
    }
    if (!body.trim()) {
      showToast('Write something to send.', 'warning');
      return;
    }
    setBusy(true);
    try {
      await saveEdits();
      // Straight to the app. Messenger: the text is copied first (see openChannel)
      const result = await openChannel(channel);
      if (!result.ok) handleOpenFailure(result.reason);
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  /** "Copy message" in the ⋯ menu */
  const handleCopy = async () => {
    setMenuOpen(false);
    try {
      await Clipboard.setStringAsync(body);
      showToast('Message copied');
    } catch {
      showToast("Couldn't copy the message.", 'error');
    }
  };

  /** "Delete" */
  const handleDelete = async () => {
    setConfirmDelete(false);
    if (isOffline) {
      showToast("You're offline. Reconnect to delete.", 'warning');
      return;
    }
    setBusy(true);
    try {
      await draftsApi.remove(draftId);
      draftEditsCache.clear(draftId);
      queryClient.removeQueries({ queryKey: ['draft', draftId] });
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      navigation.goBack();
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
      setBusy(false);
    }
  };

  const openScheduleSheet = () => setScheduleOpen(true);

  const writeMyOwn = () => {
    if (!draft) return;
    navigation.replace('WriteOwn', { contactId: draft.contactId, contactName: draft.contactName });
  };

  // "Write my own" can ask to send or schedule right after the draft is created
  const autoRan = useRef(false);
  useEffect(() => {
    if (!ready || autoRan.current) return;
    autoRan.current = true;
    if (startSend) handleSend();
    else if (openSchedule) openScheduleSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const handleSmsFallback = async () => {
    setConfirmSmsFallback(false);
    setChannel('sms');
    setBusy(true);
    try {
      await draftsApi.update(draftId, { body, tone, channel: 'sms' });
      const result = await openChannel('sms');
      if (!result.ok) handleOpenFailure(result.reason);
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSentYes = async () => {
    setBusy(true);
    try {
      const result = await draftsApi.markSent(draftId);
      refreshLists();
      setSentCheckOpen(false);
      navigation.replace('Sent', result);
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  // "Not yet — keep the draft": nothing changes
  const handleSentNotYet = () => {
    setSentCheckOpen(false);
    showToast('Draft kept. You can send it any time.', 'warning');
  };

  const handleOpenAgain = async () => {
    setSentCheckOpen(false);
    const result = await openChannel(channel);
    if (!result.ok) handleOpenFailure(result.reason);
  };

  const handleSchedule = async (selection: ScheduleSelection) => {
    if (isOffline) {
      showToast("You're offline. Reconnect to schedule.", 'error');
      return;
    }
    setBusy(true);
    try {
      await saveEdits();
      const scheduled = await draftsApi.schedule(draftId, selection);
      const targetTimeStr = scheduled.scheduledAt ?? selection.scheduledAt;
      if (targetTimeStr && draft) {
        const chosenChannel = selection.channel ?? channel;
        void scheduleFutureLocalNotification({
          id: `draft-${draftId}`,
          title: `Message for ${draft.contactName}`,
          body: `Your ${CHANNEL_LABEL[chosenChannel] ?? 'scheduled'} message is ready to send.`,
          triggerDate: new Date(targetTimeStr),
          push: {
            type: 'reminder',
            draft_id: draftId,
            contact_id: draft.contactId,
          },
        });
      }
      refreshLists();
      setScheduleOpen(false);
      showToast(`Scheduled for ${describeWhen(targetTimeStr, selection.timezone).toLowerCase()}`);
      leaveSoon();
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const runRegenerate = async () => {
    setConfirmRegenerate(false);
    if (isOffline) {
      showToast("You're offline. AI drafts are unavailable.", 'error');
      return;
    }
    setRegenerating(true);
    setRegenerateError(null);
    try {
      const updated = await draftsApi.regenerate(draftId, { tone, length, instruction });
      setBody(updated.body);
      queryClient.setQueryData(['draft', draftId], updated);
      draftEditsCache.clear(draftId);
    } catch (e) {
      setRegenerateError(getErrorMessage(e, "Couldn't write a draft."));
    } finally {
      setRegenerating(false);
    }
  };

  const handleRegenerate = () => {
    // Ask before replacing text the user has edited
    if (draft && body.trim() !== draft.body.trim()) setConfirmRegenerate(true);
    else runRegenerate();
  };

  const header = (
    <AppHeader
      title={mode === 'new' ? 'New message' : 'Review draft'}
      onBack={() => navigation.goBack()}
      right={
        draft ? (
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="More options">
            <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
          </Pressable>
        ) : undefined
      }
    />
  );

  if (isLoading) {
    return (
      <View style={styles.screen}>
        {header}
        <LoadingState message="Loading draft" />
      </View>
    );
  }
  if (isError || !draft) {
    return (
      <View style={styles.screen}>
        {header}
        <ErrorState message={getErrorMessage(error, "Couldn't load this draft.")} onRetry={() => refetch()} />
      </View>
    );
  }

  const emailSubject = REASON_LABEL[draft.reason];
  const sendRecipient =
    channel === 'email'
      ? (draft.contactEmail ?? '')
      : channel === 'messenger'
        ? (messengerUsername(draft.contactMessenger) ?? draft.contactMessenger ?? '')
        : channel === 'telegram'
          ? (draft.contactTelegram ?? '')
          : channel === 'whatsapp'
            ? (draft.contactWhatsapp ?? draft.contactPhone ?? '')
            : (draft.contactPhone ?? '');
  const scheduleNote = draft.scheduledAt
    ? `Scheduled for ${describeWhen(draft.scheduledAt, draft.contactTimezone).toLowerCase()}.`
    : null;
  const writing = draft.generation === 'pending' || regenerating;
  const generationFailed = draft.generation === 'failed' || regenerateError !== null;
  const channelOptions: ChannelOption[] = draft.contactChannels.map((value) => ({ value, label: CHANNEL_LABEL[value] }));

  // Disabled buttons say why (PRD section 9)
  let blockedReason: string | null = null;
  if (isOffline) blockedReason = "You're offline. Send, Schedule and AI drafts are unavailable.";
  else if (writing) blockedReason = 'Writing your draft…';
  else if (!body.trim()) blockedReason = 'Write something to send.';
  const sendDisabled = blockedReason !== null;

  return (
    <View style={styles.screen}>
      {header}
      <OfflineBar isOffline={isOffline} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.personCard}>
            <Avatar name={draft.contactName} imageUrl={draft.contactAvatarUrl} size={48} />
            <View style={styles.flex}>
              <Text style={styles.contactName}>{draft.contactName}</Text>
              <Text style={styles.contactMeta}>
                {draft.healthScore} · {healthWord(draft.healthScore)}
              </Text>
            </View>
            <HealthRing score={draft.healthScore} size={40} />
          </View>

          <View style={styles.reasonRow}>
            <View style={styles.reasonPill}>
              <Text style={styles.reasonText}>{REASON_LABEL[draft.reason]}</Text>
            </View>
            <Pressable
              onPress={() => setTopicOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Change what the message is about"
              style={({ pressed }) => [styles.changeBtn, pressed && styles.changePressed]}
            >
              <Ionicons name="swap-horizontal" size={15} color={colors.text} />
              <Text style={styles.changeText}>Change</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Tone</Text>
          <ToneSelector value={tone} onChange={setTone} options={DRAFT_TONE_OPTIONS} disabled={writing} />

          <Text style={styles.label}>Length</Text>
          <LengthSelector value={length} onChange={setLength} disabled={writing} />

          <Text style={styles.label}>Direction / Custom instruction</Text>
          <TextInput
            value={instruction}
            onChangeText={setInstruction}
            multiline
            textAlignVertical="top"
            placeholder="e.g. Mention their new job, keep it light"
            placeholderTextColor={colors.textFaint}
            style={styles.instruction}
            editable={!writing}
            maxLength={1000}
            accessibilityLabel="Direction or custom instruction for the AI"
          />
          <Text style={styles.hintText}>Pick tone, length and direction, then tap Regenerate.</Text>

          <View style={styles.labelRow}>
            <Text style={[styles.label, styles.labelInRow]}>Message</Text>
            <Pressable
              onPress={handleRegenerate}
              disabled={writing || isOffline}
              accessibilityRole="button"
              accessibilityState={{ disabled: writing || isOffline }}
              style={[styles.regenBtn, (writing || isOffline) && styles.dim]}
            >
              <Ionicons name="refresh" size={15} color={colors.text} />
              <Text style={styles.regenText}>Regenerate</Text>
            </Pressable>
          </View>
          <View>
            <TextInput
              value={body}
              onChangeText={setBody}
              multiline
              textAlignVertical="top"
              placeholder={writing ? '' : 'Write your message'}
              placeholderTextColor={colors.textMuted}
              style={[styles.editor, writing && styles.editorBusy]}
              editable={!writing}
              accessibilityLabel="Message text"
            />
            {writing ? (
              <View style={styles.spinner} pointerEvents="none">
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.spinnerText}>Writing your draft…</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.counterRow}>
            <CharacterCounter text={body} maxLength={MAX_LENGTH[channel]} />
          </View>

          {generationFailed ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Couldn't write a draft</Text>
              <View style={styles.errorActions}>
                <View style={styles.flex}>
                  <Button title="Try again" onPress={runRegenerate} disabled={isOffline} variant="primary" />
                </View>
                <View style={styles.flex}>
                  <Button title="Write my own" onPress={writeMyOwn} variant="secondary" />
                </View>
              </View>
            </View>
          ) : null}

          {draft.memoriesUsed.length > 0 ? (
            <>
              <Text style={styles.label}>Written from</Text>
              <View style={styles.chips}>
                {draft.memoriesUsed.map((memory) => (
                  <View key={memory} style={styles.chip}>
                    <Text style={styles.chipText}>{memory}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {channelOptions.length > 1 ? (
            <>
              <Text style={styles.label}>Send via</Text>
              <ChannelSelector value={channel} onChange={setChannel} options={channelOptions} />
            </>
          ) : null}
          <UseAnotherMedium
            available={draft.contactChannels}
            onPress={() => navigation.navigate('EditContact', { id: draft.contactId })}
          />
        </ScrollView>

        <View style={styles.footer}>
          <Text style={styles.fromLine}>{whereFromLine(channel)}</Text>
          {scheduleNote ? <Text style={styles.fromLine}>{scheduleNote}</Text> : null}
          <View style={styles.footerRow}>
            <View style={styles.flex}>
              <Button title="Schedule" onPress={openScheduleSheet} disabled={busy || sendDisabled} variant="secondary" />
            </View>
            <View style={styles.flexWide}>
              <Button title={`Send via ${CHANNEL_LABEL[channel]}`} onPress={handleSend} loading={busy} disabled={sendDisabled} variant="primary" />
            </View>
          </View>
          {blockedReason ? <Text style={styles.blocked}>{blockedReason}</Text> : null}
        </View>
      </KeyboardAvoidingView>

      <ScheduleSheet
        visible={scheduleOpen}
        draftId={draft.id}
        timezone={draft.contactTimezone}
        channels={draft.contactChannels}
        initialChannel={channel}
        initialScheduledAt={draft.scheduledAt ?? undefined}
        loading={busy}
        onClose={() => setScheduleOpen(false)}
        onConfirm={handleSchedule}
      />

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="Draft options">
        <View style={styles.menu}>
          <Pressable onPress={handleCopy} accessibilityRole="button" style={({ pressed }) => [styles.menuRow, pressed && styles.menuPressed]}>
            <Ionicons name="copy-outline" size={20} color={colors.text} />
            <Text style={styles.menuText}>Copy message</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setMenuOpen(false);
              setConfirmDelete(true);
            }}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [styles.menuRow, styles.menuBorder, pressed && styles.menuPressed]}
          >
            <Ionicons name="trash-outline" size={20} color={colors.low} />
            <Text style={[styles.menuText, styles.deleteText]}>Delete draft</Text>
          </Pressable>
        </View>
      </BottomSheet>

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete this draft?"
        message={`The draft to ${draft.contactName} will be removed.`}
        confirmLabel="Delete"
        cancelLabel="Keep draft"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <SentCheckSheet
        visible={sentCheckOpen}
        channel={channel}
        contactName={draft.contactName}
        loading={busy}
        onYes={handleSentYes}
        onNotYet={handleSentNotYet}
        onOpenAgain={handleOpenAgain}
        onClose={() => setSentCheckOpen(false)}
      />

      <TopicSheet
        visible={topicOpen}
        contactId={draft.contactId}
        contactName={draft.contactName}
        currentDraftId={draft.id}
        onClose={() => setTopicOpen(false)}
      />

      <ConfirmDialog
        visible={confirmRegenerate}
        title="Replace your edits?"
        message="Regenerating writes a new message and removes the changes you made."
        confirmLabel="Regenerate"
        cancelLabel="Keep my text"
        onConfirm={runRegenerate}
        onCancel={() => setConfirmRegenerate(false)}
      />

      <ConfirmDialog
        visible={confirmSmsFallback}
        title="WhatsApp isn't installed"
        message="Send this message by SMS instead?"
        confirmLabel="Use SMS"
        cancelLabel="Not now"
        onConfirm={handleSmsFallback}
        onCancel={() => setConfirmSmsFallback(false)}
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
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contactName: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.text },
  contactMeta: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  reasonPill: { paddingVertical: 4, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.navy },
  reasonText: { fontFamily: fonts.bold, color: colors.surface, fontSize: fontSize.sm },
  // Same pill shape as the reason pill, outlined (design: "Change" as a button, not a link)
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
  },
  changePressed: { backgroundColor: colors.divider },
  changeText: { fontFamily: fonts.bold, color: colors.text, fontSize: fontSize.sm },
  instruction: {
    fontFamily: fonts.regular,
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16, // PRD: input text is always 16 so iPhone does not zoom
  },
  hintText: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.xs },
  label: { fontFamily: fonts.semibold, fontSize: fontSize.small, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm },
  editor: {
    fontFamily: fonts.regular,
    minHeight: 160,
    padding: 14,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16, // PRD: input text is always 16 so iPhone does not zoom
    lineHeight: 25,
  },
  editorBusy: { opacity: 0.35 },
  spinner: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  spinnerText: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  counterRow: { alignItems: 'flex-end', marginTop: spacing.xs },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm },
  labelInRow: { marginTop: 0, marginBottom: 0 },
  regenBtn: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
  },
  regenText: { fontFamily: fonts.semibold, color: colors.text, fontSize: fontSize.small },
  dim: { opacity: 0.4 },
  menu: { borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: spacing.sm },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.lg },
  menuBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  menuPressed: { backgroundColor: colors.divider },
  menuText: { fontFamily: fonts.semibold, fontSize: fontSize.body, color: colors.text },
  deleteText: { color: colors.low },
  errorCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: `${colors.low}55`,
    backgroundColor: `${colors.low}0F`,
    gap: spacing.md,
  },
  errorTitle: { fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.low },
  errorActions: { flexDirection: 'row', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: `${colors.primary}14` },
  chipText: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: colors.primary },
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