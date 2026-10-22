// components/TimelineItem.tsx  (Owner: Member 2)
// Usage: <TimelineItem entry={e} isLast={i === list.length - 1} />
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSize, spacing } from '../theme/tokens';

export type TimelineType = 'message' | 'talk' | 'memory';

export type TimelineEntry = {
  id: string;
  type: TimelineType;
  title: string;
  /** Already formatted, e.g. "20 Sep 2026". */
  date: string;
  note?: string;
};

const ICONS: Record<TimelineType, React.ComponentProps<typeof Ionicons>['name']> = {
  message: 'chatbubble-ellipses-outline',
  talk: 'checkmark-circle-outline',
  memory: 'bookmark-outline',
};

export type TimelineItemProps = {
  entry: TimelineEntry;
  isLast?: boolean;
};

export default function TimelineItem({ entry, isLast = false }: TimelineItemProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View style={styles.dot}>
          <Ionicons name={ICONS[entry.type]} size={16} color={colors.primary} />
        </View>
        {!isLast && <View style={styles.line} />}
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{entry.title}</Text>
        <Text style={styles.date}>{entry.date}</Text>
        {entry.note ? <Text style={styles.note}>{entry.note}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center', width: 32 },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  body: { flex: 1, paddingBottom: spacing.lg },
  title: { fontFamily: fonts.semibold, fontSize: fontSize.md, color: colors.text },
  date: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  note: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.text, marginTop: spacing.xs },
});
