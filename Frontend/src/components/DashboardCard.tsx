/**
 * ===============================================================
 *  FILE: components/DashboardCard.tsx
 *  OWNER: Member 1  |  PHASE: 2 (Shared Components)
 *  WHAT: One small count card on Home: "2 / Due today",
 *        "2 / Overdue" (red number), "2 / Later this week".
 *        The number comes from Home.tsx as a prop.
 *  PROPS: title, count, tone ('default' | 'danger'), onPress
 *  USED BY: Home
 * ===============================================================
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSize, spacing } from '../theme/tokens';

export interface DashboardCardProps {
  title: string;
  count: number;
  /** 'danger' shows the number in red (used for Overdue) */
  tone?: 'default' | 'danger';
  onPress?: () => void;
}

export function DashboardCard({ title, count, tone = 'default', onPress }: DashboardCardProps) {
  const content = (
    <>
      <Text style={[styles.count, tone === 'danger' && styles.countDanger]}>{count}</Text>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.card} accessible accessibilityLabel={`${count} ${title}`}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${count} ${title}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md + 2,
    gap: spacing.xxs,
    minHeight: 76,
  },
  pressed: {
    opacity: 0.8,
  },
  count: {
    fontFamily: fonts.extrabold,
    fontSize: 24,
    color: colors.text,
  },
  countDanger: {
    color: colors.lowText,
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
});
