// components/AppHeader.tsx  (Owner: Member 4)
// Two looks:
//   variant="large" -> big left title (Schedule, Settings)
//   variant="bar"   -> compact bar with optional back arrow (Notifications)
// Usage:
//   <AppHeader title="Schedule" />
//   <AppHeader variant="bar" title="Notifications" onBack={goBack} rightLabel="Mark all read" onRightPress={markAll} />
// Wrap the screen in <SafeAreaView edges={['top']}>; the header does not add the top inset itself.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';

export type AppHeaderProps = {
  title: string;
  subtitle?: string;
  variant?: 'large' | 'bar';
  onBack?: () => void;
  rightLabel?: string;
  onRightPress?: () => void;
  rightDisabled?: boolean;
  /** Custom right-hand element (e.g. an icon button). Wins over rightLabel. */
  right?: React.ReactNode;
  /** Large title inside a screen that already has side padding (Schedule, Settings) */
  flush?: boolean;
};

export default function AppHeader({
  title,
  subtitle,
  variant,
  onBack,
  rightLabel,
  onRightPress,
  rightDisabled = false,
  right,
  flush = false,
}: AppHeaderProps): React.JSX.Element {
  const look = variant ?? (onBack ? 'bar' : 'large');
  const rightNode =
    right ??
    (rightLabel ? (
      <Pressable
        onPress={onRightPress}
        disabled={rightDisabled || !onRightPress}
        hitSlop={8}
        accessibilityRole="button"
      >
        <Text style={[styles.rightLabel, rightDisabled && styles.disabled]}>{rightLabel}</Text>
      </Pressable>
    ) : null);

  if (look === 'bar') {
    // Design: 60px white bar, 44x44 back button, 18px title (centered unless a text action sits on the right)
    const centered = !rightLabel || !!right;
    return (
      <View style={styles.bar}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={8} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        ) : centered ? (
          <View style={styles.iconBtn} />
        ) : null}
        <Text style={[styles.barTitle, centered && styles.barTitleCenter]} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {rightNode ? <View style={styles.rightSlot}>{rightNode}</View> : centered ? <View style={styles.iconBtn} /> : null}
      </View>
    );
  }

  return (
    <View style={[styles.large, flush && styles.largeFlush]}>
      <View style={styles.flex}>
        <Text style={styles.largeTitle}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightNode}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  large: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  largeFlush: { paddingHorizontal: spacing.xs, paddingTop: spacing.sm },
  largeTitle: { fontFamily: fonts.extrabold, fontSize: fontSize.title, letterSpacing: -0.7, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, marginTop: spacing.xs },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 60,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: { width: 44, height: 44, borderRadius: radius.input, alignItems: 'center', justifyContent: 'center' },
  rightSlot: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  barTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  barTitleCenter: { textAlign: 'center' },
  rightLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  disabled: { opacity: 0.4 },
});
