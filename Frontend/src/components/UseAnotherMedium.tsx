// components/UseAnotherMedium.tsx
// Link under "Send via": the contact has no number / username for some mediums, so they
// are hidden. Tapping it opens the contact's Edit page to fill them in and unlock them.
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, fontSize, spacing } from '../theme/tokens';
import type { Channel } from '../types/draft';

/** Every medium the app can send through */
export const ALL_CHANNELS: Channel[] = ['whatsapp', 'sms', 'telegram', 'email', 'messenger'];

export interface UseAnotherMediumProps {
  /** Mediums this contact already has details for */
  available: Channel[];
  onPress: () => void;
}

export default function UseAnotherMedium({ available, onPress }: UseAnotherMediumProps): React.JSX.Element | null {
  // Nothing left to unlock
  if (ALL_CHANNELS.every((c) => available.includes(c))) return null;
  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel="Use another medium" style={styles.wrap} hitSlop={8}>
      <Text style={styles.link}>Use another medium</Text>
      <Text style={styles.hint}>Add a number or username in the contact's details to unlock more ways to send.</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md, gap: 2 },
  link: { fontFamily: fonts.semibold, fontSize: fontSize.md, color: colors.primary },
  hint: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
});
