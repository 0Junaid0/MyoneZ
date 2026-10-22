// components/CalendarStrip.tsx  (Owner: Member 4)
// Row of day cells. Up to 7 days it fills the width; more than 7 scrolls sideways.
// Usage:
//   <CalendarStrip days={days} selected={selected} today={today} markers={markers} onSelect={setSelected} />
// markers: dateKey(date) -> 'due' (blue dot) | 'overdue' (red dot)
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

// Small date helpers shared with Schedule.tsx
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export type CalendarMarker = 'due' | 'overdue';

export type CalendarStripProps = {
  days: Date[];
  selected: Date;
  today: Date;
  markers?: Record<string, CalendarMarker>;
  onSelect: (date: Date) => void;
};

export default function CalendarStrip({
  days,
  selected,
  today,
  markers = {},
  onSelect,
}: CalendarStripProps): React.JSX.Element {
  const { width } = useWindowDimensions();
  const scrolls = days.length > 7;
  // screen padding (lg * 2) + card padding (sm * 2), split into 7 columns
  const cellWidth = (width - spacing.lg * 2 - spacing.sm * 2) / 7;

  const cells = days.map((d) => {
    const isSelected = isSameDay(d, selected);
    const marker = markers[dateKey(d)];
    return (
      <Pressable
        key={dateKey(d)}
        onPress={() => onSelect(d)}
        style={[styles.cell, scrolls ? { width: cellWidth } : styles.cellFlex, isSelected && styles.cellSelected]}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${
          isSameDay(d, today) ? ', today' : ''
        }`}
      >
        <Text style={[styles.weekday, isSelected && styles.textOnDark]}>{WEEKDAYS[d.getDay()]}</Text>
        <Text style={[styles.dayNum, isSelected && styles.textOnDark]}>{d.getDate()}</Text>
        <View
          style={[
            styles.dot,
            marker === 'overdue' && { backgroundColor: colors.danger },
            marker === 'due' && { backgroundColor: isSelected ? '#93C5FD' : colors.primary },
          ]}
        />
      </Pressable>
    );
  });

  return (
    <View style={styles.card}>
      {scrolls ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {cells}
        </ScrollView>
      ) : (
        <View style={styles.row}>{cells}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  row: { flexDirection: 'row' },
  cell: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.input,
    gap: 4,
  },
  cellFlex: { flex: 1 },
  cellSelected: { backgroundColor: colors.text },
  weekday: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted },
  dayNum: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.text },
  textOnDark: { color: colors.primaryText },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'transparent' },
});
