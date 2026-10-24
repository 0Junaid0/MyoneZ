// STEP: PHASE 1 · Shared setup · used by M09, M09b, M15
import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';

const OVERLAY = 'rgba(15,23,42,0.45)';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function BottomSheet({ visible, onClose, title, children }: BottomSheetProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close panel" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.handle} />
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: OVERLAY },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  title: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.text, marginBottom: spacing.md },
});
