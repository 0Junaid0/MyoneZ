// STEP: PHASE 2 · Page-step 9 · yellow / blue note used by M15 and M18
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';

export interface NoteBannerProps {
  /** yellow = "already scheduled" notes, blue = information */
  variant?: 'yellow' | 'blue';
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function NoteBanner({ variant = 'yellow', text, actionLabel, onAction }: NoteBannerProps): React.JSX.Element {
  const accent = variant === 'yellow' ? colors.fair : colors.primary;
  return (
    <View style={[styles.box, { backgroundColor: `${accent}14`, borderColor: `${accent}55` }]}>
      <Text style={styles.text}>{text}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8} style={styles.action}>
          <Text style={[styles.actionText, { color: accent }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.input, padding: spacing.md },
  text: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.text, lineHeight: 21 },
  action: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  actionText: { fontFamily: fonts.bold, fontSize: fontSize.md },
});
