// components/ScheduleItem.tsx  (Owner: Member 4)
// One row in a schedule list. Three looks, picked by leading / trailing:
//   overdue: leading avatar + trailing red text   ("since 11 Sep")
//   today:   leading time text + trailing badge   ("9:00 AM" ... "Ready")
//   later:   leading date text + trailing chevron ("Thu 8" ...  >)
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from './Avatar';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';

export type ScheduleBadgeTone = 'blue' | 'pink' | 'gray';

export type ScheduleLeading = { type: 'avatar' } | { type: 'text'; text: string };

export type ScheduleTrailing =
  | { type: 'text'; text: string; danger?: boolean }
  | { type: 'badge'; label: string; tone: ScheduleBadgeTone }
  | { type: 'chevron' };

export type ScheduleItemProps = {
  name: string;
  subtitle: string;
  leading: ScheduleLeading;
  trailing: ScheduleTrailing;
  onPress?: () => void;
};

const BADGE: Record<ScheduleBadgeTone, { bg: string; fg: string }> = {
  blue: { bg: '#DBEAFE', fg: '#1E40AF' },
  pink: { bg: '#FCE7F3', fg: '#9D174D' },
  gray: { bg: '#E2E8F0', fg: '#475569' },
};

export default function ScheduleItem({
  name,
  subtitle,
  leading,
  trailing,
  onPress,
}: ScheduleItemProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${name}, ${subtitle}`}
    >
      {leading.type === 'avatar' ? (
        <Avatar name={name} size={44} />
      ) : (
        <Text style={styles.leadingText}>{leading.text}</Text>
      )}

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      {trailing.type === 'text' && (
        <Text style={[styles.trailingText, trailing.danger && styles.danger]}>{trailing.text}</Text>
      )}
      {trailing.type === 'badge' && (
        <View style={[styles.badge, { backgroundColor: BADGE[trailing.tone].bg }]}>
          <Text style={[styles.badgeText, { color: BADGE[trailing.tone].fg }]}>{trailing.label}</Text>
        </View>
      )}
      {trailing.type === 'chevron' && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  pressed: { opacity: 0.6 },
  leadingText: { fontFamily: fonts.semibold, width: 68, fontSize: fontSize.md, color: colors.text },
  info: { flex: 1 },
  name: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.text },
  sub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  trailingText: { fontFamily: fonts.semibold, fontSize: fontSize.md, color: colors.textMuted },
  danger: { color: '#B91C1C' },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  badgeText: { fontFamily: fonts.bold, fontSize: fontSize.sm },
});
