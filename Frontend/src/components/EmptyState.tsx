/**
 * ===============================================================
 *  FILE: components/EmptyState.tsx
 *  OWNER: Member 1  |  PHASE: 2 (Shared Components)
 *  WHAT: What a page shows when there is no data yet,
 *        e.g. "No contacts yet" + an Add contact button.
 *  PROPS: title, description, actionLabel, onAction, icon
 *  USED BY: Home, Contacts, Drafts, Schedule, Notifications (all members)
 *  EXAMPLE:
 *    <EmptyState title="All caught up" description="Nothing to review." />
 * ===============================================================
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Inbox } from 'lucide-react-native';
import { Button } from './Button';
import { colors, fonts, fontSize, spacing } from '../theme/tokens';

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Same as description (older Member 2 / 4 code uses this name) */
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Optional custom icon; a tray icon is used if not given */
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, message, actionLabel, onAction, icon }: EmptyStateProps) {
  const body = description ?? message;
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>{icon ?? <Inbox size={28} color={colors.primary} />}</View>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.description}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSize.section,
    color: colors.text,
    textAlign: 'center',
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: fontSize.body,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
  },
});

// Default export too, so Member 2 / 3 / 4 code can write: import EmptyState from './EmptyState'
export default EmptyState;
