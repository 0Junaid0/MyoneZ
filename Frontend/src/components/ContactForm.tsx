// components/ContactForm.tsx  (Owner: Member 2)
// ONE form used by both AddContact and EditContact.
//
// Usage:
//   <ContactForm mode="create" onSubmit={save} onCancel={goBack} submitting={busy} />
//   <ContactForm mode="edit" initialValues={values} onSubmit={save} onCancel={goBack} onDelete={askDelete} />
import React, { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import DatePicker, { formatDate, formatDayMonth } from './DatePicker';
import FrequencySelector, { DEFAULT_FREQUENCY, validateFrequency } from './FrequencySelector';
import type { FrequencyValue } from './FrequencySelector';
import FilterChip from './FilterChip';
import { MEMORY_CATEGORIES } from './MemoryCard';
import type { MemoryCategory } from './MemoryCard';
import type { Relationship } from './ContactCard';
// Owned by Member 1:
import InputField from './InputField';
// Owned by Member 3 / Member 4 (stubs exist until they deliver):
import ToneSelector from './ToneSelector';
import type { Tone } from './ToneSelector';
import ChannelSelector from './ChannelSelector';
import type { ChannelOption } from './ChannelSelector';
import type { ContactChannel } from '../types/draft';
import ToggleSwitch from './ToggleSwitch';
import ConfirmDialog from './ConfirmDialog';
import { messengerUsername } from '../utils/messaging';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';

export type ContactFormValues = {
  photoUri: string | null;
  firstName: string;
  lastName: string;
  relationship: Relationship;
  /** Comma separated, e.g. "Inner circle, Family". Use parseTags() to split. */
  tags: string;
  phone: string;
  whatsappSame: boolean;
  whatsapp: string;
  telegram: string;
  /** Messenger username, e.g. rafiq.ahmed.10 */
  messenger: string;
  email: string;
  channel: ContactChannel;
  frequency: FrequencyValue;
  lastContact: Date | null;
  birthday: Date | null;
  timezone: string;
  memoryCategory: MemoryCategory;
  memoryText: string;
  tone: Tone;
};

export const EMPTY_CONTACT_VALUES: ContactFormValues = {
  photoUri: null,
  firstName: '',
  lastName: '',
  relationship: 'Friend',
  tags: '',
  phone: '',
  whatsappSame: true,
  whatsapp: '',
  telegram: '',
  messenger: '',
  email: '',
  channel: 'whatsapp',
  frequency: DEFAULT_FREQUENCY,
  lastContact: null,
  birthday: null,
  timezone: 'Asia/Dhaka (GMT+6)',
  memoryCategory: 'values',
  memoryText: '',
  tone: 'warm',
};

export function parseTags(tags: string): string[] {
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export type ContactFormProps = {
  mode: 'create' | 'edit';
  initialValues?: ContactFormValues;
  onSubmit: (values: ContactFormValues) => void | Promise<void>;
  /** Called after the user cancels (and confirms discarding, if there are unsaved changes). */
  onCancel: () => void;
  submitting?: boolean;
  /** Edit mode only: shows a Delete button. The page owns the confirmation. */
  onDelete?: () => void;
};

const CHANNEL_OPTIONS: ChannelOption<ContactChannel>[] = [
  { value: 'none', label: 'Not set' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Gmail' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'messenger', label: 'Messenger' },
  { value: 'sms', label: 'SMS' },
];

const MESSENGER_STEPS: string[] = [
  'Open the Messenger chat with them.',
  'Tap their name at the top of the chat.',
  'Look under their profile for the username.',
  'Or copy their Facebook profile link and paste it here. Both work.',
];


const RELATIONSHIPS: Relationship[] = ['Mentor', 'Friend', 'Family', 'Professional', 'Collaborator'];

const TIMEZONES: string[] = [
  'Asia/Dhaka (GMT+6)',
  'Asia/Kolkata (GMT+5:30)',
  'Asia/Dubai (GMT+4)',
  'Europe/London (GMT+0)',
  'Europe/Berlin (GMT+1)',
  'America/New_York (GMT-5)',
  'America/Los_Angeles (GMT-8)',
  'Australia/Sydney (GMT+10)',
];

type Errors = Partial<Record<'firstName' | 'contact' | 'email' | 'messenger' | 'channel' | 'frequency', string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(v: ContactFormValues): Errors {
  const errors: Errors = {};
  if (!v.firstName.trim()) errors.firstName = 'First name is required.';

  const hasWhatsapp = v.whatsappSame ? v.phone.trim().length > 0 : v.whatsapp.trim().length > 0;
  if (!v.phone.trim() && !hasWhatsapp && !v.telegram.trim() && !v.email.trim() && !v.messenger.trim()) {
    errors.contact = 'Add at least one way to reach them.';
  }
  if (v.email.trim() && !EMAIL_RE.test(v.email.trim())) errors.email = 'Enter a valid email address.';
  if (v.messenger.trim() && !messengerUsername(v.messenger)) {
    errors.messenger = 'Use the Messenger username (rafiq.ahmed.10) or their profile link.';
  }

  if (v.channel === 'telegram' && !v.telegram.trim()) errors.channel = 'Add a Telegram username to use Telegram.';
  if (v.channel === 'whatsapp' && !hasWhatsapp) errors.channel = 'Add a WhatsApp number to use WhatsApp.';
  if (v.channel === 'sms' && !v.phone.trim()) errors.channel = 'Add a phone number to use SMS.';
  if (v.channel === 'email' && !v.email.trim()) errors.channel = 'Add an email address to use Gmail.';
  if (v.channel === 'messenger' && !v.messenger.trim()) errors.channel = 'Add a Messenger username to use Messenger.';

  const freqError = validateFrequency(v.frequency);
  if (freqError) errors.frequency = freqError;
  return errors;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function checkInPreview(v: ContactFormValues): string | null {
  if (validateFrequency(v.frequency)) return null;
  const base = v.lastContact ?? new Date();
  const { mode, days, jitter } = v.frequency;
  const lo = addDays(base, mode === 'fixed' ? days : Math.max(1, days - jitter));
  const hi = addDays(base, mode === 'fixed' ? days : days + jitter);
  if (lo.toDateString() === hi.toDateString()) return formatDate(lo);
  if (lo.getMonth() === hi.getMonth() && lo.getFullYear() === hi.getFullYear()) {
    return `Between ${lo.getDate()} and ${formatDate(hi)}`;
  }
  return `Between ${formatDate(lo)} and ${formatDate(hi)}`;
}

function Section({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

export default function ContactForm({
  mode,
  initialValues,
  onSubmit,
  onCancel,
  submitting = false,
  onDelete,
}: ContactFormProps): React.JSX.Element {
  const initial = useRef<ContactFormValues>(initialValues ?? EMPTY_CONTACT_VALUES).current;
  const [values, setValues] = useState<ContactFormValues>(initial);
  const [attempted, setAttempted] = useState<boolean>(false);
  const [discardOpen, setDiscardOpen] = useState<boolean>(false);
  const [messengerHelpOpen, setMessengerHelpOpen] = useState<boolean>(false);

  const set = <K extends keyof ContactFormValues>(key: K, value: ContactFormValues[K]): void =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const isDirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(initial), [values, initial]);
  const errors = useMemo(() => validate(values), [values]);
  const shown: Errors = attempted ? errors : {};
  const preview = checkInPreview(values);

  const handleSave = (): void => {
    setAttempted(true);
    if (Object.keys(errors).length > 0) return;
    void onSubmit(values);
  };

  const handleCancel = (): void => {
    if (isDirty) setDiscardOpen(true);
    else onCancel();
  };

  const pickPhoto = async (): Promise<void> => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) set('photoUri', result.assets[0].uri);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleCancel} hitSlop={8} accessibilityRole="button">
          <Text style={styles.headerLink}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{mode === 'create' ? 'New contact' : 'Edit contact'}</Text>
        <Pressable onPress={handleSave} disabled={submitting} hitSlop={8} accessibilityRole="button">
          <Text style={[styles.headerLink, submitting && styles.disabled]}>
            {submitting ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Basics */}
          <Section>
            <Pressable style={styles.photoWrap} onPress={pickPhoto} accessibilityRole="button">
              <View style={styles.photo}>
                {values.photoUri ? (
                  <Image source={{ uri: values.photoUri }} style={styles.photoImg} />
                ) : (
                  <Ionicons name="camera-outline" size={24} color={colors.textMuted} />
                )}
              </View>
              <Text style={styles.photoText}>{values.photoUri ? 'Change photo' : 'Add photo'}</Text>
            </Pressable>
            <InputField
              label="First name *"
              value={values.firstName}
              onChangeText={(t: string) => set('firstName', t)}
              error={shown.firstName}
              autoCapitalize="words"
            />
            <InputField
              label="Last name"
              value={values.lastName}
              onChangeText={(t: string) => set('lastName', t)}
              autoCapitalize="words"
            />
          </Section>

          {/* Relationship */}
          <Section title="Who are they to you?">
            <View style={styles.chipsWrap}>
              {RELATIONSHIPS.map((r) => (
                <FilterChip
                  key={r}
                  label={r}
                  selected={values.relationship === r}
                  onPress={() => set('relationship', r)}
                />
              ))}
            </View>
            <InputField
              label="Tags"
              value={values.tags}
              onChangeText={(t: string) => set('tags', t)}
              placeholder="Inner circle, Family"
            />
          </Section>

          {/* Reach */}
          <Section title="How to reach them" subtitle="Add at least one">
            <View style={styles.phoneRow}>
              <View style={styles.dial}>
                <Text style={styles.dialText}>+880</Text>
              </View>
              <View style={styles.flex}>
                <InputField
                  label="Phone"
                  value={values.phone}
                  onChangeText={(t: string) => set('phone', t)}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
            <ToggleSwitch
              label="WhatsApp on the same number"
              description="Turn off to add a different one"
              value={values.whatsappSame}
              onValueChange={(v) => set('whatsappSame', v)}
            />
            {!values.whatsappSame && (
              <InputField
                label="WhatsApp number"
                value={values.whatsapp}
                onChangeText={(t: string) => set('whatsapp', t)}
                keyboardType="phone-pad"
              />
            )}
            <InputField
              label="Telegram username"
              value={values.telegram}
              onChangeText={(t: string) => set('telegram', t)}
              placeholder="@username"
              autoCapitalize="none"
            />
            <InputField
              label="Messenger username or profile link"
              value={values.messenger}
              onChangeText={(t: string) => set('messenger', t)}
              error={shown.messenger}
              placeholder="rafiq.ahmed.10"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              onPress={() => setMessengerHelpOpen((o) => !o)}
              accessibilityRole="button"
              accessibilityState={{ expanded: messengerHelpOpen }}
              style={styles.helpToggle}
            >
              <Ionicons name={messengerHelpOpen ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.primary} />
              <Text style={styles.helpToggleText}>How to find a Messenger username</Text>
            </Pressable>
            {messengerHelpOpen ? (
              <View style={styles.info}>
                <View style={styles.flex}>
                  {MESSENGER_STEPS.map((step, i) => (
                    <Text key={step} style={styles.infoText}>
                      {i + 1}. {step}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}
            <InputField
              label="Email"
              value={values.email}
              onChangeText={(t: string) => set('email', t)}
              error={shown.email}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {shown.contact ? <Text style={styles.error}>{shown.contact}</Text> : null}

            <Text style={styles.fieldLabel}>Usually message them on</Text>
            <ChannelSelector<ContactChannel>
              value={values.channel}
              onChange={(c) => set('channel', c)}
              options={CHANNEL_OPTIONS}
            />
            {shown.channel ? <Text style={styles.error}>{shown.channel}</Text> : null}
            {values.channel === 'telegram' && (
              <View style={styles.info}>
                <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.infoText}>
                  For Telegram, {values.firstName.trim() || 'they'} must tap Start on your MyOneZ bot once.
                  We&apos;ll give you an invite link to share.
                </Text>
              </View>
            )}
          </Section>

          {/* Frequency */}
          <Section title="How often to check in" subtitle="MyOneZ prepares a draft when it's time">
            <FrequencySelector
              value={values.frequency}
              onChange={(f) => set('frequency', f)}
              error={shown.frequency}
            />
            <DatePicker
              label="Last time you talked"
              value={values.lastContact}
              onChange={(d) => set('lastContact', d)}
              maximumDate={new Date()}
              hint="Not sure? Leave it empty and we'll start from today."
            />
            {preview ? (
              <View style={styles.preview}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                <View style={styles.flex}>
                  <Text style={styles.previewLabel}>First check-in</Text>
                  <Text style={styles.previewValue}>{preview}</Text>
                  <Text style={styles.previewNote}>
                    If that date has already passed, the first draft is ready today.
                  </Text>
                </View>
              </View>
            ) : null}
          </Section>

          {/* More */}
          <Section title="More about them">
            <DatePicker
              label="Birthday"
              value={values.birthday}
              onChange={(d) => set('birthday', d)}
              format={formatDayMonth}
            />
            <Text style={styles.fieldLabel}>Their timezone</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {TIMEZONES.map((tz) => (
                <FilterChip
                  key={tz}
                  label={tz}
                  selected={values.timezone === tz}
                  onPress={() => set('timezone', tz)}
                />
              ))}
            </ScrollView>
            <Text style={styles.fieldLabel}>Something to remember · optional</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {(Object.keys(MEMORY_CATEGORIES) as MemoryCategory[]).map((k) => (
                <FilterChip
                  key={k}
                  label={MEMORY_CATEGORIES[k].title}
                  selected={values.memoryCategory === k}
                  onPress={() => set('memoryCategory', k)}
                />
              ))}
            </ScrollView>
            <InputField
              label="Memory"
              value={values.memoryText}
              onChangeText={(t: string) => set('memoryText', t)}
              placeholder="e.g. Reviewed my pitch deck in July"
              multiline
            />
          </Section>

          {/* Messages */}
          <Section title="Messages">
            <Text style={styles.fieldLabel}>Tone</Text>
            <ToneSelector value={values.tone} onChange={(t) => set('tone', t)} />
          </Section>

          {mode === 'edit' && onDelete ? (
            <Pressable style={styles.deleteBtn} onPress={onDelete} accessibilityRole="button">
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={styles.deleteText}>Delete contact</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={discardOpen}
        title="Discard changes?"
        message="You have unsaved changes. They will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          setDiscardOpen(false);
          onCancel();
        }}
        onCancel={() => setDiscardOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.text },
  headerLink: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.primary },
  disabled: { opacity: 0.5 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl * 2 },

  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: { fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.text },
  sectionSub: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted, marginTop: -spacing.sm },
  fieldLabel: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  error: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: colors.danger },

  photoWrap: { alignItems: 'center', gap: spacing.sm },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.textMuted,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImg: { width: 72, height: 72 },
  photoText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.primary },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chipsRow: { gap: spacing.sm, paddingRight: spacing.lg },

  phoneRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  dial: {
    height: 48,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  dialText: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.text },

  helpToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 32 },
  helpToggleText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.primary },
  info: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.input,
    backgroundColor: colors.primarySoft,
  },
  infoText: { fontFamily: fonts.regular, flex: 1, fontSize: fontSize.xs, color: colors.text },

  preview: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.input,
    backgroundColor: colors.primarySoft,
  },
  previewLabel: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted },
  previewValue: { fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.text },
  previewNote: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteText: { fontFamily: fonts.semibold, color: colors.danger, fontSize: fontSize.md },
});