// STEP: PHASE 2 + Page-step 6 · M09 Did you send it? (sheet)
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSize, spacing } from '../theme/tokens';
import { Channel } from '../types/draft';
import BottomSheet from './BottomSheet';
import Button from './Button';

export interface SentCheckSheetProps {
  visible: boolean;
  channel: Channel;
  contactName: string;
  /** "Yes, mark as sent": the only action that logs the message */
  onYes: () => void;
  /** "Not yet — keep the draft": nothing changes, the draft stays as it is */
  onNotYet: () => void;
  onOpenAgain: () => void;
  /** Dismissed without answering; the draft stays unchanged */
  onClose: () => void;
  loading?: boolean;
}

const APP_LABEL: Record<Channel, string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  telegram: 'Telegram',
  email: 'Gmail',
  messenger: 'Messenger',
};

export default function SentCheckSheet({
  visible,
  channel,
  contactName,
  onYes,
  onNotYet,
  onOpenAgain,
  onClose,
  loading = false,
}: SentCheckSheetProps): React.JSX.Element {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Did you send it?">
      <Text style={styles.body}>
        Opening {APP_LABEL[channel]} doesn't send the message to {contactName}. MyOneZ logs it as sent only when you say yes.
      </Text>
      <View style={styles.actions}>
        <Button title="Yes, mark as sent" onPress={onYes} loading={loading} variant="primary" />
        <Button title="Not yet — keep the draft" onPress={onNotYet} disabled={loading} variant="secondary" />
        <Button title={`Open ${APP_LABEL[channel]} again`} onPress={onOpenAgain} disabled={loading} variant="secondary" />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textMuted, lineHeight: 22 },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
});
