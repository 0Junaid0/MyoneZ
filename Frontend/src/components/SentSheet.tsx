// components/SentSheet.tsx
// Opens when a card in Drafts -> Sent is tapped. Shows only what was sent, how it was
// written, and a Reschedule button. No editing, no Regenerate, no Send.
import dayjs from 'dayjs';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';
import type { Draft } from '../types/draft';
import { CHANNEL_LABEL, REASON_LABEL } from '../utils/labels';
import BottomSheet from './BottomSheet';
import Button from './Button';

export interface SentSheetProps {
  draft: Draft | null;
  visible: boolean;
  loading?: boolean;
  onClose: () => void;
  onReschedule: (draft: Draft) => void;
}

const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export default function SentSheet({ draft, visible, loading = false, onClose, onReschedule }: SentSheetProps): React.JSX.Element {
  const rows = draft
    ? [
        { label: 'Sent to', value: draft.contactName },
        { label: 'Purpose', value: REASON_LABEL[draft.reason] },
        { label: 'Channel', value: CHANNEL_LABEL[draft.channel] },
        { label: 'Tone', value: capitalise(draft.tone) },
        { label: 'Length', value: capitalise(draft.length) },
        { label: 'Sent', value: dayjs(draft.updatedAt).format('D MMM YYYY · h:mm A') },
      ]
    : [];
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Sent message">
      {draft ? (
        <>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Message</Text>
            <View style={styles.bodyBox}>
              <Text style={styles.body}>{draft.body}</Text>
            </View>
            <Text style={[styles.label, styles.gap]}>Details</Text>
            <View style={styles.card}>
              {rows.map((r, i) => (
                <View key={r.label} style={[styles.row, i > 0 && styles.rowBorder]}>
                  <Text style={styles.rowLabel}>{r.label}</Text>
                  <Text style={styles.rowValue}>{r.value}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
          <View style={styles.footer}>
            <Button title="Reschedule" onPress={() => onReschedule(draft)} loading={loading} variant="primary" />
          </View>
        </>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 460 },
  label: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: colors.text, marginBottom: spacing.sm },
  gap: { marginTop: spacing.lg },
  bodyBox: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.background },
  body: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.text, lineHeight: 22 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.md, gap: spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowLabel: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textMuted },
  rowValue: { flex: 1, textAlign: 'right', fontFamily: fonts.medium, fontSize: fontSize.md, color: colors.text },
  footer: { marginTop: spacing.lg },
});
