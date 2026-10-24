// STEP: PHASE 2 · Page-step 1 · draft card on M07 Drafts and M09c Scheduled list
import dayjs from 'dayjs';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';
import { Draft } from '../types/draft';
import { CHANNEL_LABEL, REASON_LABEL } from '../utils/labels';
import { describeWhen } from '../utils/time';
import Avatar from './Avatar';

export interface MessageCardAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export interface MessageCardProps {
  draft: Draft;
  onPress: () => void;
  actions?: MessageCardAction[];
  /** Shown under the actions, e.g. why they are disabled */
  note?: string;
  /** Blue border: the next message to go out (M09c) */
  highlighted?: boolean;
}

/** The grey line under a scheduled card's name (design M09c). Version 1 is reminder-only. */
function scheduledLine(draft: Draft): string {
  return `We'll ping you and open ${CHANNEL_LABEL[draft.channel]} with the message ready.`;
}

function ReminderBadge(): React.JSX.Element {
  const fg = colors.fairText;
  return (
    <View style={[styles.badge, { backgroundColor: colors.fairSoft }]}>
      <Ionicons name="notifications-outline" size={14} color={fg} />
      <Text style={[styles.badgeText, { color: fg }]}>Reminder</Text>
    </View>
  );
}

function Pill({ label, color }: { label: string; color: string }): React.JSX.Element {
  return (
    <View style={[styles.pill, { backgroundColor: `${color}1A` }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export default function MessageCard({ draft, onPress, actions = [], note, highlighted = false }: MessageCardProps): React.JSX.Element {
  const scheduled = draft.status === 'scheduled' && !!draft.scheduledAt;
  const sent = draft.status === 'sent';
  const late = draft.daysLate > 0 ? ` · ${draft.daysLate} ${draft.daysLate === 1 ? 'day' : 'days'} late` : '';
  return (
    <View style={[styles.card, highlighted && styles.cardHighlighted]}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${sent ? 'sent ' : ''}message for ${draft.contactName}`}>
        <View style={styles.header}>
          <Avatar name={draft.contactName} imageUrl={draft.contactAvatarUrl} size={44} />
          <View style={styles.headerText}>
            <Text style={styles.name} numberOfLines={1}>{draft.contactName}</Text>
            {scheduled ? (
              <Text style={styles.when}>{describeWhen(draft.scheduledAt as string, draft.contactTimezone)}</Text>
            ) : sent ? (
              <Text style={styles.meta}>Sent · {dayjs(draft.updatedAt).format('D MMM YYYY, h:mm A')}</Text>
            ) : (
              <Text style={[styles.meta, draft.daysLate > 0 && { color: colors.low }]}>
                {REASON_LABEL[draft.reason]}{late}
              </Text>
            )}
          </View>
          {scheduled ? <ReminderBadge /> : <Pill label={CHANNEL_LABEL[draft.channel]} color={colors.primary} />}
        </View>

        {scheduled ? (
          <Text style={styles.line}>{scheduledLine(draft)}</Text>
        ) : (
          <Text style={styles.preview} numberOfLines={2}>{draft.body}</Text>
        )}
        {sent ? (
          <Text style={styles.meta}>
            {REASON_LABEL[draft.reason]} · {draft.tone.charAt(0).toUpperCase() + draft.tone.slice(1)} · {draft.length.charAt(0).toUpperCase() + draft.length.slice(1)}
          </Text>
        ) : null}
        {draft.status === 'failed' && draft.failureReason ? <Text style={styles.failure}>{draft.failureReason}</Text> : null}
      </Pressable>

      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              disabled={action.disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: action.disabled }}
              style={({ pressed }) => [
                styles.action,
                action.destructive && styles.actionDestructive,
                action.disabled && styles.actionDisabled,
                pressed && styles.actionPressed,
              ]}
            >
              <Text style={[styles.actionText, action.destructive && styles.actionTextDestructive]} numberOfLines={1}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHighlighted: { borderWidth: 2, borderColor: colors.primary, padding: spacing.lg - 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1 },
  name: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.text },
  when: { fontFamily: fonts.medium, fontSize: fontSize.md, color: colors.textSecondary, marginTop: 2 },
  meta: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeText: { fontFamily: fonts.bold, fontSize: fontSize.sm },
  pill: { paddingVertical: 3, paddingHorizontal: spacing.sm, borderRadius: radius.pill },
  pillText: { fontFamily: fonts.semibold, fontSize: fontSize.sm },
  line: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textMuted, marginTop: spacing.md, lineHeight: 21 },
  preview: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.text, marginTop: spacing.md, lineHeight: 21 },
  failure: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.low, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  action: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
  },
  actionDestructive: { borderColor: colors.lowBorder },
  actionDisabled: { opacity: 0.4 },
  actionPressed: { backgroundColor: colors.divider },
  actionText: { fontFamily: fonts.medium, fontSize: fontSize.md, color: colors.text },
  actionTextDestructive: { color: colors.lowText },
  note: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.sm },
});
