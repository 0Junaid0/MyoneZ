// STEP: PHASE 2 · Page-step 1 · status pill (M07 / Schedule)
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';
import { DraftStatus } from '../types/draft';

export interface StatusBadgeProps {
  status: DraftStatus;
}

const CONFIG: Record<DraftStatus, { label: string; color: string }> = {
  pending_review: { label: 'To review', color: colors.textMuted },
  scheduled: { label: 'Scheduled', color: colors.primary },
  sent: { label: 'Sent', color: colors.healthy },
  failed: { label: 'Failed', color: colors.low },
};

export default function StatusBadge({ status }: StatusBadgeProps): React.JSX.Element {
  const { label, color } = CONFIG[status] ?? CONFIG.pending_review;
  return (
    <View style={[styles.badge, { backgroundColor: `${color}1A` }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  text: { fontFamily: fonts.semibold, fontSize: fontSize.sm },
});
