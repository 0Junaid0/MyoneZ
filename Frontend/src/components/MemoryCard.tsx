// components/MemoryCard.tsx  (Owner: Member 2)
// One memory row. Usage: <MemoryCard memory={m} />
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';

export type MemoryCategory = 'values' | 'interests' | 'gratitude' | 'events';

export type Memory = {
  id: string;
  category: MemoryCategory;
  text: string;
  /** Included when a draft is written. */
  selected: boolean;
  /** Small pill next to the title, e.g. "Not thanked yet". */
  badge?: string;
};

type CategoryStyle = {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tileBg: string;
  color: string;
};

export const MEMORY_CATEGORIES: Record<MemoryCategory, CategoryStyle> = {
  values: { title: 'Values', icon: 'shield-outline', tileBg: '#E0E7FF', color: '#3730A3' },
  interests: { title: 'Shared interests', icon: 'link-outline', tileBg: '#CFFAFE', color: '#155E75' },
  gratitude: { title: 'Gratitude', icon: 'heart-outline', tileBg: '#FEF3C7', color: '#92400E' },
  events: { title: 'Life events', icon: 'calendar-outline', tileBg: '#FCE7F3', color: '#9D174D' },
};

export type MemoryCardProps = {
  memory: Memory;
  onToggle?: (selected: boolean) => void;
};

export default function MemoryCard({ memory, onToggle }: MemoryCardProps): React.JSX.Element {
  const cfg = MEMORY_CATEGORIES[memory.category] ?? MEMORY_CATEGORIES.values;

  return (
    <View style={styles.row}>
      <View style={[styles.tile, { backgroundColor: cfg.tileBg }]}>
        <Ionicons name={cfg.icon} size={20} color={cfg.color} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: cfg.color }]}>{cfg.title}</Text>
          {memory.badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{memory.badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.text}>{memory.text}</Text>
      </View>
      {onToggle ? (
        <Pressable
          onPress={() => onToggle(!memory.selected)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: memory.selected }}
          accessibilityLabel={`Include ${memory.text} in drafts`}
          hitSlop={8}
          style={[styles.check, memory.selected && styles.checkOn]}
        >
          {memory.selected ? <Ionicons name="checkmark" size={16} color={colors.onDark} /> : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md },
  tile: {
    width: 44,
    height: 44,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontFamily: fonts.bold, fontSize: fontSize.sm },
  badge: {
    backgroundColor: '#FEF3C7',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { fontFamily: fonts.semibold, fontSize: fontSize.xs, color: '#92400E' },
  text: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.text, marginTop: 2, lineHeight: 21 },
  check: {
    width: 24,
    height: 24,
    marginTop: 2,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkOn: { borderColor: colors.primary, backgroundColor: colors.primary },
});
