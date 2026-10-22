/**
 * ===============================================================
 *  FILE: components/UpcomingActionCard.tsx
 *  OWNER: Member 1  |  PHASE: 2 (Shared Components)
 *  WHAT: One row in the Home "Up next" list:
 *        [Avatar]  Ayesha Rahman            [3 days late]  (o 32%)
 *                  Friend · 74 days ago
 *        Tapping it opens the draft (or the contact if no draft yet).
 *  PROPS: item (one UpNextItem from GET /api/home/), onPress, showDivider
 *  NEEDS FROM MEMBER 2:
 *        components/Avatar.tsx      → <Avatar name imageUrl size />
 *        components/HealthRing.tsx  → <HealthRing score size />
 *  USED BY: Home
 * ===============================================================
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from './Avatar'; // Member 2
import { HealthRing } from './HealthRing'; // Member 2
import type { UpNextItem } from '../types/api';
import { colors, fonts, fontSize, radius, sizes, spacing } from '../theme/tokens';

export interface UpcomingActionCardProps {
  item: UpNextItem;
  onPress: (item: UpNextItem) => void;
  /** Thin line under the row (false for the last row) */
  showDivider?: boolean;
}

function lastContactText(days: number | null): string {
  if (days === null) return 'Never talked';
  if (days === 0) return 'Talked today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function statusPill(item: UpNextItem): { label: string; text: string; background: string } {
  if (item.status === 'overdue') {
    const late = item.days_late ?? 1;
    return {
      label: late === 1 ? '1 day late' : `${late} days late`,
      text: colors.lowText,
      background: colors.lowSoft,
    };
  }
  if (item.status === 'today') {
    return { label: 'Today', text: colors.primary, background: colors.primarySoft };
  }
  // upcoming → short weekday, e.g. "Thu"
  const date = new Date(`${item.due_date}T00:00:00`);
  const label = Number.isNaN(date.getTime())
    ? 'Soon'
    : date.toLocaleDateString('en-US', { weekday: 'short' });
  return { label, text: colors.textMuted, background: colors.neutralSoft };
}

export function UpcomingActionCard({ item, onPress, showDivider = true }: UpcomingActionCardProps) {
  const pill = statusPill(item);
  const subtitle = `${item.relationship} · ${lastContactText(item.last_contacted_days)}`;

  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${subtitle}, ${pill.label}, health ${item.health_score} percent`}
      accessibilityHint={item.draft_id ? 'Opens the draft message' : 'Opens the contact'}
      style={({ pressed }) => [
        styles.row,
        showDivider && styles.divider,
        pressed && styles.pressed,
      ]}
    >
      <Avatar name={item.name} imageUrl={item.avatar_url} size={sizes.avatar + 4} />

      <View style={styles.middle}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={[styles.pill, { backgroundColor: pill.background }]}>
            <Text style={[styles.pillText, { color: pill.text }]}>{pill.label}</Text>
          </View>
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <HealthRing score={item.health_score} size={40} />
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
    minHeight: 68,
    backgroundColor: colors.surface,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  pressed: {
    backgroundColor: colors.primaryTint,
  },
  middle: {
    flex: 1,
    gap: spacing.xxs,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: fontSize.body,
    color: colors.text,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
  },
  pillText: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.tab,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSize.small,
    color: colors.textFaint,
  },
});
