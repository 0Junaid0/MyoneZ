// STEP: PHASE 2 · Shared component · cancel / discard confirmation
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for delete / cancel actions */
  destructive?: boolean;
}

export default function ConfirmDialog({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Keep',
  destructive = false,
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.row}>
            <Pressable style={[styles.btn, styles.cancel]} onPress={onCancel} accessibilityRole="button">
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { backgroundColor: destructive ? colors.low : colors.primary }]}
              onPress={onConfirm}
              accessibilityRole="button"
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: spacing.xxl },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  title: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.text },
  message: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 22 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.lg, gap: spacing.sm },
  btn: { paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg, borderRadius: radius.input },
  cancel: { backgroundColor: colors.background },
  cancelText: { fontFamily: fonts.semibold, color: colors.text, fontSize: fontSize.md },
  confirmText: { fontFamily: fonts.bold, color: colors.surface, fontSize: fontSize.md },
});
